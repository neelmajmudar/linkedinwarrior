"""One-off script to generate embeddings for all existing users' scraped posts.

Run from the backend directory:
    python scripts/backfill_embeddings.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_supabase
from app.services.embeddings import embed_posts_for_user


async def main():
    db = get_supabase()

    # Get all user IDs that have scraped posts
    result = (
        db.table("scraped_posts")
        .select("user_id")
        .execute()
    )

    user_ids = list({row["user_id"] for row in (result.data or [])})
    print(f"Found {len(user_ids)} users with scraped posts")

    total = 0
    for i, user_id in enumerate(user_ids, 1):
        print(f"\n[{i}/{len(user_ids)}] Processing user={user_id}")
        try:
            count = await embed_posts_for_user(user_id)
            total += count
            print(f"  → Embedded {count} new posts")
        except Exception as e:
            print(f"  → ERROR: {e}")

    print(f"\nDone. Total new embeddings created: {total}")


if __name__ == "__main__":
    asyncio.run(main())
