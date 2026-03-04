-- Multi-tenant organizations / teams feature

-- Required for gen_random_bytes used in invite token default
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor',  -- owner, admin, editor, viewer
    display_name TEXT,
    color TEXT,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);

CREATE TABLE IF NOT EXISTS org_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, expired
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_org_invites_token ON org_invites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON org_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email);

-- ============================================================
-- 2. Schema changes to existing tables
-- ============================================================

-- content_items: optional org association
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_org_id ON content_items(org_id);
CREATE INDEX IF NOT EXISTS idx_content_items_org_scheduled ON content_items(org_id, scheduled_at)
    WHERE org_id IS NOT NULL AND status IN ('scheduled', 'publishing');

-- users: track which org the user is currently viewing
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Helper function for RLS
-- ============================================================

CREATE OR REPLACE FUNCTION is_org_member(check_org_id UUID, check_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM org_members
        WHERE org_id = check_org_id
          AND user_id = auth.uid()
          AND (check_roles IS NULL OR role = ANY(check_roles))
    );
$$;

-- ============================================================
-- 4. RLS policies for new tables
-- ============================================================

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON organizations
    FOR SELECT USING (
        is_org_member(id)
        OR created_by = auth.uid()
    );

CREATE POLICY organizations_insert ON organizations
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY organizations_update ON organizations
    FOR UPDATE USING (
        is_org_member(id, ARRAY['owner', 'admin'])
    );

CREATE POLICY organizations_delete ON organizations
    FOR DELETE USING (
        is_org_member(id, ARRAY['owner'])
    );

-- org_members
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_select ON org_members
    FOR SELECT USING (
        is_org_member(org_id)
    );

CREATE POLICY org_members_insert ON org_members
    FOR INSERT WITH CHECK (
        is_org_member(org_id, ARRAY['owner', 'admin'])
        OR user_id = auth.uid()  -- allow self-insert when accepting invite
    );

CREATE POLICY org_members_update ON org_members
    FOR UPDATE USING (
        is_org_member(org_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY org_members_delete ON org_members
    FOR DELETE USING (
        is_org_member(org_id, ARRAY['owner', 'admin'])
        OR user_id = auth.uid()  -- allow self-leave
    );

-- org_invites
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_select ON org_invites
    FOR SELECT USING (
        is_org_member(org_id, ARRAY['owner', 'admin'])
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY org_invites_insert ON org_invites
    FOR INSERT WITH CHECK (
        is_org_member(org_id, ARRAY['owner', 'admin'])
    );

CREATE POLICY org_invites_update ON org_invites
    FOR UPDATE USING (
        is_org_member(org_id, ARRAY['owner', 'admin'])
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY org_invites_delete ON org_invites
    FOR DELETE USING (
        is_org_member(org_id, ARRAY['owner', 'admin'])
    );

-- ============================================================
-- 5. Additional RLS for content_items (org-scoped reads)
-- ============================================================

-- Allow org members to read content belonging to their org
CREATE POLICY content_items_org_select ON content_items
    FOR SELECT USING (
        org_id IS NOT NULL AND is_org_member(org_id)
    );

-- Allow org admins+ to update others' content in their org
CREATE POLICY content_items_org_update ON content_items
    FOR UPDATE USING (
        org_id IS NOT NULL
        AND is_org_member(org_id, ARRAY['owner', 'admin'])
    );

-- ============================================================
-- 6. Enable Supabase Realtime on key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE content_items;
ALTER PUBLICATION supabase_realtime ADD TABLE org_members;
