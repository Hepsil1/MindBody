import json
import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def migrate_data():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if we already have products
    if db.query(models.Product).count() > 0:
        print("Database already has products. Skipping migration.")
        return

    data_dir = "../data"
    files = ["products_women.json", "products_kids.json"]
    
    for filename in files:
        filepath = os.path.join(data_dir, filename)
        if not os.path.exists(filepath):
            print(f"File {filepath} not found.")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            products_data = json.load(f)
            
            for p in products_data:
                # Map JSON fields to SQL model
                db_product = models.Product(
                    id=p.get("id"),
                    name=p.get("name"),
                    category=p.get("category"),
                    price=p.get("price"),
                    old_price=p.get("oldPrice"),
                    description=p.get("description", ""),
                    images=p.get("images", []),
                    colors=p.get("colors", []),
                    sizes=p.get("sizes", []),
                    collection=p.get("collection"),
                    badge=p.get("badge"),
                    is_new=p.get("isNew", False)
                )
                db.add(db_product)
    
    db.commit()
    print("Migration complete!")
    db.close()

if __name__ == "__main__":
    migrate_data()
