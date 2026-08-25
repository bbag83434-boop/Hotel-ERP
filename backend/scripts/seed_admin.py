import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")
load_dotenv(backend_dir.parent / ".env")

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, Role, UserBranch
from app.models.organization import Company, Branch

def seed_super_admin():
    db: Session = SessionLocal()
    try:
        print("=" * 60)
        print("   SEEDING SUPER ADMIN USER (Google OAuth Enabled)")
        print("=" * 60)

        # 1. Ensure SUPER_ADMIN Role exists
        super_admin_role = db.query(Role).filter(Role.name == "SUPER_ADMIN").first()
        if not super_admin_role:
            print("[+] Creating 'SUPER_ADMIN' role...")
            super_admin_role = Role(
                id=str(uuid.uuid4()),
                name="SUPER_ADMIN",
                description="Super Admin with full system access and wildcard (*:*) permissions",
                is_system=True
            )
            db.add(super_admin_role)
            db.flush()
        else:
            print(f"[OK] 'SUPER_ADMIN' role found (ID: {super_admin_role.id})")

        # 2. Ensure Root Company exists
        company = db.query(Company).first()
        if not company:
            print("[+] Creating default HQ company...")
            company = Company(
                id=str(uuid.uuid4()),
                name="CB RKM Hospitality",
                code="CB_HQ",
                is_active=True
            )
            db.add(company)
            db.flush()
        else:
            print(f"[OK] Root company found: '{company.name}' (Code: {company.code}, ID: {company.id})")

        # 3. Ensure Default Head Office Branch exists (must match type == HEAD_OFFICE,
        # NOT just "the first branch found" -- old test outlets may already exist)
        branch = db.query(Branch).filter(
            Branch.company_id == company.id,
            Branch.type == "HEAD_OFFICE",
        ).first()
        if not branch:
            print("[+] Creating default Head Office branch...")
            branch = Branch(
                id=str(uuid.uuid4()),
                company_id=company.id,
                name="Head Office & Central Commissary",
                code="HQ01",
                type="HEAD_OFFICE",
                is_active=True
            )
            db.add(branch)
            db.flush()
        else:
            print(f"[OK] Primary branch found: '{branch.name}' (Code: {branch.code}, ID: {branch.id})")

        # 4. Check if Admin User exists
        target_email = "bbag83434@gmail.com"
        user = db.query(User).filter(User.email.ilike(target_email)).first()

        if user:
            print(f"[i] User with email '{target_email}' already exists. Updating role and status...")
            user.role_id = super_admin_role.id
            user.company_id = company.id
            user.is_active = True
            user.first_name = "Biswanath"
            user.last_name = "Bag"
        else:
            print(f"[+] Creating Super Admin user for '{target_email}'...")
            dummy_hash = get_password_hash(str(uuid.uuid4()))
            user = User(
                id=str(uuid.uuid4()),
                company_id=company.id,
                role_id=super_admin_role.id,
                email=target_email,
                username="bbag83434",
                password_hash=dummy_hash,
                first_name="Biswanath",
                last_name="Bag",
                is_active=True
            )
            db.add(user)
            db.flush()

        # 5. Link User to all active branches
        # First, clear any stale "is_default" flag from previous test data so the
        # real HEAD_OFFICE branch always wins as the default.
        db.query(UserBranch).filter(UserBranch.user_id == user.id).update(
            {UserBranch.is_default: False}
        )

        all_branches = db.query(Branch).filter(Branch.is_active == True).all()
        for b in all_branches:
            ub = db.query(UserBranch).filter(
                UserBranch.user_id == user.id,
                UserBranch.branch_id == b.id
            ).first()
            is_default_branch = (b.id == branch.id)
            if ub:
                ub.is_default = is_default_branch
                continue
            if not ub:
                db.add(UserBranch(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    branch_id=b.id,
                    is_default=is_default_branch
                ))

        db.commit()
        db.refresh(user)
        print("\n[SUCCESS] Super Admin account configured successfully!")
        print("-" * 60)
        print(f"ID:         {user.id}")
        print(f"Name:       {user.first_name} {user.last_name}")
        print(f"Email:      {user.email}")
        print(f"Role:       {super_admin_role.name}")
        print(f"Company:    {company.name} ({company.id})")
        print(f"Is Active:  {user.is_active}")
        print(f"Branches:   {[f'{b.name} (Type: {b.type}, Default: {b.id == branch.id})' for b in all_branches]}")
        print("-" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Failed to seed Super Admin: {e}", file=sys.stderr)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_super_admin()