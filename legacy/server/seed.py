# -*- coding: utf-8 -*-
"""
Seed script for MIND BODY database
Populates initial data for testing
"""
import sys
from database import SessionLocal
import models
import auth
from datetime import datetime

def seed_database():
    db = SessionLocal()
    
    try:
        print("Starting database seeding...")
        
        # 1. Create Admin User
        print("\n[1/6] Check/Create admin user...")
        existing_admin = db.query(models.AdminUser).filter(models.AdminUser.email == "admin@mindbody.ua").first()
        if not existing_admin:
            admin = models.AdminUser(
                email="admin@mindbody.ua",
                hashed_password=auth.get_password_hash("admin123"),
                full_name="Admin User"
            )
            db.add(admin)
            db.commit()
            print("   OK Admin created: admin@mindbody.ua / admin123")
        else:
            print("   INFO Admin already exists")
        
        # 2. Create Categories
        print("\n[2/6] Creating categories...")
        cat_women = db.query(models.Category).filter(models.Category.slug == "women").first()
        if not cat_women:
            cat_women = models.Category(
                name="Women",
                slug="women",
                description="Women sportswear collection",
                is_active=True
            )
            db.add(cat_women)
            print("   Created 'Women' category")
        
        cat_kids = db.query(models.Category).filter(models.Category.slug == "kids").first()
        if not cat_kids:
            cat_kids = models.Category(
                name="Kids",
                slug="kids",
                description="Kids sportswear collection",
                is_active=True
            )
            db.add(cat_kids)
            print("   Created 'Kids' category")
            
        db.commit()
        db.refresh(cat_women)
        db.refresh(cat_kids)
        
        # 3. Create Collections
        print("\n[3/6] Creating collections...")
        coll_winter = db.query(models.Collection).filter(models.Collection.slug == "winter").first()
        if not coll_winter:
            coll_winter = models.Collection(
                name="Winter",
                slug="winter",
                description="Winter collection",
                is_active=True
            )
            db.add(coll_winter)
            print("   Created 'Winter' collection")
            
        coll_active = db.query(models.Collection).filter(models.Collection.slug == "active").first()
        if not coll_active:
            coll_active = models.Collection(
                name="Active",
                slug="active",
                description="Active collection",
                is_active=True
            )
            db.add(coll_active)
            print("   Created 'Active' collection")
            
        db.commit()
        db.refresh(coll_winter)
        db.refresh(coll_active)
        
        # 4. Create Sample Products
        print("\n[4/6] Creating sample products...")
        
        def get_or_create_product(p_id, **kwargs):
            p = db.query(models.Product).filter(models.Product.id == p_id).first()
            if not p:
                p = models.Product(id=p_id, **kwargs)
                db.add(p)
                db.commit()
                print(f"   Created product {p_id}")
            else:
                print(f"   Product {p_id} exists")
            db.refresh(p)
            return p

        product1 = get_or_create_product(
            "winter-cherry-bell",
            name="SCHEMER WINTER bell (Cherry)",
            slug="winter-cherry-bell",
            description="Warm flare jumpsuit from premium fabric",
            price=3490,
            old_price=None,
            category_id=cat_women.id,
            sku="WCB-001",
            quantity=20,
            fabric="80% cotton, 20% polyester",
            care_instructions="Wash at 30C",
            status="published",
            badge="HOT",
            is_new=True
        )
        if coll_winter not in product1.collections:
            product1.collections.append(coll_winter)
        
        product2 = get_or_create_product(
            "chocolate-jumpsuit",
            name="SCHEMER WINTER (Chocolate)",
            slug="chocolate-jumpsuit",
            description="Chocolate jumpsuit for active leisure",
            price=3290,
            old_price=3690,
            category_id=cat_women.id,
            sku="CJ-002",
            quantity=15,
            fabric="75% cotton, 25% elastane",
            care_instructions="Wash at 30C, do not bleach",
            status="published",
            badge="SALE",
            is_new=False
        )
        if coll_winter not in product2.collections:
            product2.collections.append(coll_winter)
        
        product3 = get_or_create_product(
            "kids-purple-set",
            name="Kids Set (Purple)",
            slug="kids-purple-set",
            description="Soft and comfortable set for kids",
            price=1990,
            category_id=cat_kids.id,
            sku="KPS-003",
            quantity=30,
            fabric="100% cotton",
            care_instructions="Wash at 40C",
            status="published",
            badge="NEW",
            is_new=True
        )
        if coll_active not in product3.collections:
            product3.collections.append(coll_active)
        
        db.commit()
        
        # Add images for products (Clear first to avoid dupes)
        db.query(models.ProductImage).delete()
        db.query(models.ProductVariant).delete()
        db.commit()
        
        images = [
            models.ProductImage(product_id="winter-cherry-bell", url="pics1cloths/IMG_6201.JPG", order=0, is_primary=True),
            models.ProductImage(product_id="winter-cherry-bell", url="pics1cloths/IMG_6203.JPG", order=1, is_primary=False),
            models.ProductImage(product_id="chocolate-jumpsuit", url="pics2cloths/IMG_4971.JPG", order=0, is_primary=True),
            models.ProductImage(product_id="chocolate-jumpsuit", url="pics2cloths/IMG_4972.JPG", order=1, is_primary=False),
            models.ProductImage(product_id="kids-purple-set", url="pics2cloths/IMG_5222.JPG", order=0, is_primary=True),
        ]
        db.add_all(images)
        
        # Add variants
        variants = [
            # Winter Cherry Bell variants
            models.ProductVariant(product_id="winter-cherry-bell", size="XS", color_name="Cherry", color_code="#8B1538", quantity=5),
            models.ProductVariant(product_id="winter-cherry-bell", size="S", color_name="Cherry", color_code="#8B1538", quantity=8),
            models.ProductVariant(product_id="winter-cherry-bell", size="M", color_name="Cherry", color_code="#8B1538", quantity=7),
            
            # Chocolate Jumpsuit variants
            models.ProductVariant(product_id="chocolate-jumpsuit", size="S", color_name="Chocolate", color_code="#4A2511", quantity=5),
            models.ProductVariant(product_id="chocolate-jumpsuit", size="M", color_name="Chocolate", color_code="#4A2511", quantity=6),
            models.ProductVariant(product_id="chocolate-jumpsuit", size="L", color_name="Chocolate", color_code="#4A2511", quantity=4),
            
            # Kids Purple Set variants
            models.ProductVariant(product_id="kids-purple-set", size="4-6", color_name="Purple", color_code="#6B4C9A", quantity=10),
            models.ProductVariant(product_id="kids-purple-set", size="7-9", color_name="Purple", color_code="#6B4C9A", quantity=12),
            models.ProductVariant(product_id="kids-purple-set", size="10-12", color_name="Purple", color_code="#6B4C9A", quantity=8),
        ]
        db.add_all(variants)
        db.commit()
        
        print("   OK Created/Reset images and variants")
        
        # 5. Create Home Page with Sections
        print("\n[5/6] Creating homepage builder config...")
        home_page = db.query(models.Page).filter(models.Page.slug == "home").first()
        if not home_page:
            home_page = models.Page(
                slug="home",
                title="Home Page",
                status="published",
                published_at=datetime.utcnow()
            )
            db.add(home_page)
            db.commit()
            
            # Add sections only if creating new page
            sections = [
                models.PageSection(
                    page_id=home_page.id,
                    type="hero",
                    enabled=True,
                    order=0,
                    props={
                        "images": [
                            "pics1cloths/IMG_6201.JPG",
                            "pics1cloths/IMG_6203.JPG",
                            "generalpics/348_131123.jpg"
                        ]
                    }
                ),
                models.PageSection(
                    page_id=home_page.id,
                    type="categories",
                    enabled=True,
                    order=1,
                    props={
                        "title": "Choose Your Style",
                        "subtitle": "Collections for active lifestyle"
                    }
                ),
                models.PageSection(
                    page_id=home_page.id,
                    type="products",
                    enabled=True,
                    order=2,
                    props={
                        "title": "New Arrivals",
                        "product_ids": ["winter-cherry-bell", "chocolate-jumpsuit", "kids-purple-set"]
                    }
                ),
                models.PageSection(
                    page_id=home_page.id,
                    type="values",
                    enabled=True,
                    order=3,
                    props={
                        "items": [
                            {"icon": "truck", "title": "Free Shipping", "text": "On orders over 3000 UAH"},
                            {"icon": "shield", "title": "Quality Guarantee", "text": "14 days return policy"},
                            {"icon": "heart", "title": "Ukrainian Made", "text": "Support local brand"}
                        ]
                    }
                ),
                models.PageSection(
                    page_id=home_page.id,
                    type="newsletter",
                    enabled=True,
                    order=4,
                    props={
                        "title": "Subscribe to Newsletter",
                        "subtitle": "Get exclusive offers"
                    }
                )
            ]
            db.add_all(sections)
            db.commit()
            print("   Created homepage with sections")
        else:
             print("   Homepage already exists")
        
        # 6. Create a Test Customer & Order
        print("\n[6/6] Creating test customer and order...")
        customer = db.query(models.Customer).filter(models.Customer.email == "test@example.com").first()
        if not customer:
            customer = models.Customer(
                email="test@example.com",
                hashed_password=auth.get_password_hash("test123"),
                full_name="Test Customer",
                phone="+380671234567",
                city="Odesa",
                address="Deribasivska str., 1",
                loyalty_points=0,
                is_active=True
            )
            db.add(customer)
            db.commit()
            
            order = models.Order(
                order_number="ORD-100001",
                customer_id=customer.id,
                total_amount=3490,
                status="processing",
                delivery_city="Odesa",
                delivery_address="Branch #5",
                payment_method="cash_on_delivery"
            )
            db.add(order)
            db.commit()
            
            order_item = models.OrderItem(
                order_id=order.id,
                product_id=product1.id,
                name=product1.name,
                size="M",
                color="Cherry",
                price=3490,
                quantity=1
            )
            db.add(order_item)
            db.commit()
            print("   OK Created test customer and order")
        else:
            print("   Test customer already exists")
        
        print("\n=== Database seeding completed successfully! ===")
        print("\nSummary:")
        print("   - 1 Admin user (admin@mindbody.ua / admin123)")
        print("   - 2 Categories")
        print("   - 2 Collections")
        print("   - 3 Products with images and variants")
        print("   - 1 Homepage with 5 sections")
        print("   - 1 Test customer")
        print("   - 1 Test order")
        
    except Exception as e:
        print(f"\nERROR during seeding: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
