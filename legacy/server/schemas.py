from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

# --- Component Schemas ---
class ProductImage(BaseModel):
    url: str
    alt_text: Optional[str] = None
    is_primary: bool = False
    order: int = 0
    
    class Config:
        from_attributes = True

class ProductVariant(BaseModel):
    size: str
    color_name: str
    color_code: str
    sku: Optional[str] = None
    quantity: int
    price_adjustment: float = 0.0
    
    class Config:
        from_attributes = True

# --- Product Schemas ---
class ProductBase(BaseModel):
    id: str
    name: str
    slug: str
    category_id: Optional[int] = None
    price: float
    old_price: Optional[float] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    fabric: Optional[str] = None
    care_instructions: Optional[str] = None
    status: str = "draft"
    badge: Optional[str] = None
    is_new: bool = False

class ProductCreate(ProductBase):
    images: List[ProductImage] = []
    variants: List[ProductVariant] = []

class Product(ProductBase):
    images: List[ProductImage] = []
    variants: List[ProductVariant] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    old_price: Optional[float] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    fabric: Optional[str] = None
    care_instructions: Optional[str] = None
    status: Optional[str] = None
    badge: Optional[str] = None
    is_new: Optional[bool] = None

# --- Category Schemas ---
class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None

class Category(CategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Media Schemas ---
class MediaFile(BaseModel):
    id: int
    filename: str
    original_name: str
    url: str
    folder: str
    file_size: int
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Customer Schemas (prev. User) ---
class CustomerBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    password: str

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None

class Customer(CustomerBase):
    id: int
    loyalty_points: int = 0
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Admin User Schemas ---
class AdminUser(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Order Schemas ---
class OrderItem(BaseModel):
    product_id: Optional[str]  # Make optional as product might be null
    name: str
    price: float
    quantity: int
    size: Optional[str] = None
    color: Optional[str] = None
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    total_amount: float
    items: List[OrderItem]
    delivery_city: str
    delivery_address: str
    payment_method: str
    # Guest fields
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None

class Order(OrderCreate):
    id: int
    order_number: str
    customer_id: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[Customer] = None # Return user info with token

class TokenData(BaseModel):
    email: Optional[str] = None
    is_admin: bool = False
