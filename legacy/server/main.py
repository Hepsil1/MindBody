from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import models, schemas, database, auth
import shutil
import os
import uuid
import random
from datetime import datetime, timedelta

app = FastAPI(title="MIND BODY API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if not exists
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Dependency ---
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth ---
@app.post("/register", response_model=schemas.Token)
def register(user_data: schemas.CustomerCreate, db: Session = Depends(get_db)):
    # Check existing
    db_user = db.query(models.Customer).filter(models.Customer.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create Customer
    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.Customer(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        phone=user_data.phone,
        city=user_data.city,
        address=user_data.address
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate Token
    access_token = auth.create_access_token(data={"sub": new_user.email, "is_admin": False})
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Try Customer first
    customer = db.query(models.Customer).filter(models.Customer.email == form_data.username).first()
    if customer and customer.hashed_password and auth.verify_password(form_data.password, customer.hashed_password):
        access_token = auth.create_access_token(data={"sub": customer.email, "is_admin": False})
        return {"access_token": access_token, "token_type": "bearer", "user": customer}
    
    # Try Admin
    admin = db.query(models.AdminUser).filter(models.AdminUser.email == form_data.username).first()
    if admin and auth.verify_password(form_data.password, admin.hashed_password):
        # Update last login
        admin.last_login = datetime.utcnow()
        db.commit()
        access_token = auth.create_access_token(data={"sub": admin.email, "is_admin": True})
        # Note: AdminUser schema doesn't match Customer schema exactly, so we might need a Union or specific response
        # For simple compatibility with frontend expect "user" object
        return {"access_token": access_token, "token_type": "bearer", "user": None} # Frontend handles this

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

@app.get("/users/me", response_model=schemas.Customer)
def read_users_me(current_user: models.Customer = Depends(auth.get_current_user)):
    return current_user

# --- Products ---
@app.get("/products", response_model=List[schemas.Product])
def get_products(category: str = None, collection: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Product).filter(models.Product.status == 'published')
    
    if category:
        # Join with Category table to filter by category slug
        query = query.join(models.Category).filter(models.Category.slug == category)
        
    if collection:
        # Join with Collection table
        query = query.join(models.Product.collections).filter(models.Collection.slug == collection)
        
    return query.all()

@app.get("/products/{product_id}", response_model=schemas.Product)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        # Try finding by slug if ID lookup fails
        product = db.query(models.Product).filter(models.Product.slug == product_id).first()
        
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/products", response_model=schemas.Product)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    # Only Admin can create products
    db_product = models.Product(**product.model_dump(exclude={'images', 'variants'}))
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}

@app.put("/products/{product_id}", response_model=schemas.Product)
def update_product(product_id: str, product_update: schemas.ProductUpdate, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update only provided fields
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)
    
    db.commit()
    db.refresh(product)
    return product

# --- Categories ---
@app.get("/categories", response_model=List[schemas.Category])
def get_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).filter(models.Category.is_active == True).all()

@app.get("/categories/{category_id}", response_model=schemas.Category)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@app.post("/categories", response_model=schemas.Category)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.put("/categories/{category_id}", response_model=schemas.Category)
def update_category(category_id: int, category_update: schemas.CategoryUpdate, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = category_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    db.commit()
    db.refresh(category)
    return category

@app.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"message": "Category deleted"}

# --- Media Upload ---
@app.post("/media/upload")
async def upload_media(
    file: UploadFile = File(...), 
    folder: str = "general",
    db: Session = Depends(get_db), 
    admin: models.AdminUser = Depends(auth.get_current_admin)
):
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, folder)
    
    # Create folder if not exists
    if not os.path.exists(file_path):
        os.makedirs(file_path)
    
    full_path = os.path.join(file_path, unique_filename)
    
    # Save file
    with open(full_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Get file size
    file_size = os.path.getsize(full_path)
    
    # Create DB record
    media_file = models.MediaFile(
        filename=unique_filename,
        original_name=file.filename,
        url=f"/uploads/{folder}/{unique_filename}",
        folder=folder,
        file_size=file_size,
        mime_type=file.content_type or "image/jpeg"
    )
    db.add(media_file)
    db.commit()
    db.refresh(media_file)
    
    return {
        "id": media_file.id,
        "url": media_file.url,
        "filename": media_file.filename,
        "original_name": media_file.original_name
    }

@app.get("/media", response_model=List[schemas.MediaFile])
def get_media(folder: str = None, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    query = db.query(models.MediaFile)
    if folder:
        query = query.filter(models.MediaFile.folder == folder)
    return query.order_by(models.MediaFile.created_at.desc()).all()

@app.delete("/media/{media_id}")
def delete_media(media_id: int, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    media = db.query(models.MediaFile).filter(models.MediaFile.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete file from disk
    file_path = os.path.join(UPLOAD_DIR, media.folder, media.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.delete(media)
    db.commit()
    return {"message": "Media deleted"}

# --- Orders ---
@app.get("/orders", response_model=List[schemas.Order])
def get_orders(db: Session = Depends(get_db), current_user: models.Customer = Depends(auth.get_current_user)):
    # Customers can only see their own orders
    # Admins should hit a different endpoint or we check logic here
    # For now, implementing customer view
    return db.query(models.Order).filter(models.Order.customer_id == current_user.id).order_by(models.Order.created_at.desc()).all()

@app.post("/orders", response_model=schemas.Order)
def create_order(
    order: schemas.OrderCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[models.Customer] = Depends(auth.get_current_user_optional)
):
    # Generate sequential order number
    order_count = db.query(models.Order).count()
    order_number = f"MB-{str(order_count + 1).zfill(6)}"
    
    customer_id = current_user.id if current_user else None
    
    db_order = models.Order(
        order_number=order_number,
        customer_id=customer_id,
        total_amount=order.total_amount,
        delivery_city=order.delivery_city,
        delivery_address=order.delivery_address,
        payment_method=order.payment_method,
        status="new",
        
        # Snapshot guest info if provided
        customer_name=order.customer_name or (current_user.full_name if current_user else None),
        customer_email=order.customer_email or (current_user.email if current_user else None),
        customer_phone=order.customer_phone or (current_user.phone if current_user else None)
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Create Order Items
    for item in order.items:
        db_item = models.OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            name=item.name,
            price=item.price,
            quantity=item.quantity,
            size=item.size,
            color=item.color
        )
        db.add(db_item)
    
    db.commit()
    return db_order

# --- Admin Stats ---
@app.get("/admin/orders", response_model=List[schemas.Order])
def get_admin_orders(db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    # Admin sees ALL orders, newest first
    return db.query(models.Order).order_by(models.Order.created_at.desc()).all()

@app.put("/admin/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status
    db.commit()
    return {"message": "Status updated"}

@app.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db), admin: models.AdminUser = Depends(auth.get_current_admin)):
    revenue = db.query(func.sum(models.Order.total_amount)).scalar() or 0
    orders_count = db.query(models.Order).count()
    products_count = db.query(models.Product).count()
    customers_count = db.query(models.Customer).count()
    
    return {
        "revenue": revenue,
        "orders_count": orders_count,
        "products_count": products_count,
        "customers_count": customers_count
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
