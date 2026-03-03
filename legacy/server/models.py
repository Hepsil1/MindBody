from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Text, JSON, Table
from sqlalchemy.orm import relationship
import datetime
from database import Base

# Association table for product-collection many-to-many relationship
product_collections = Table(
    'product_collections',
    Base.metadata,
    Column('product_id', String, ForeignKey('products.id'), primary_key=True),
    Column('collection_id', Integer, ForeignKey('collections.id'), primary_key=True)
)

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)  # Optional for guest checkout
    full_name = Column(String)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    address = Column(String, nullable=True)
    loyalty_points = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    google_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    orders = relationship("Order", back_populates="customer")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    products = relationship("Product", back_populates="category_rel")

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    products = relationship("Product", secondary=product_collections, back_populates="collections")

class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)  # Using slugs like 'winter-cherry-bell'
    name = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float)
    old_price = Column(Float, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    sku = Column(String, unique=True, nullable=True)
    quantity = Column(Integer, default=0)
    fabric = Column(Text, nullable=True)
    care_instructions = Column(Text, nullable=True)
    size_chart_url = Column(String, nullable=True)
    status = Column(String, default="draft")  # draft, published
    seo_title = Column(String, nullable=True)
    seo_description = Column(Text, nullable=True)
    badge = Column(String, nullable=True)  # NEW, HOT, SALE
    is_new = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    category_rel = relationship("Category", back_populates="products")
    collections = relationship("Collection", secondary=product_collections, back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")

class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"))
    url = Column(String)
    alt_text = Column(String, nullable=True)
    order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="images")

class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"))
    size = Column(String)  # XXS, XS, S, M, L, XL
    color_name = Column(String)  # Чорний, Вишня
    color_code = Column(String)  # #1A1A1A, #8B1538
    sku = Column(String, unique=True, nullable=True)
    quantity = Column(Integer, default=0)
    price_adjustment = Column(Float, default=0.0)  # Additional price for this variant
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="variants")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True)  # e.g., "ORD-123456"
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)  # Nullable for guest orders
    total_amount = Column(Float)
    status = Column(String, default="new")  # new, processing, shipped, delivered, cancelled
    tracking_number = Column(String, nullable=True)
    internal_notes = Column(Text, nullable=True)
    delivery_city = Column(String)
    delivery_address = Column(String)
    payment_method = Column(String)  # cash_on_delivery, liqpay, etc.
    customer_name = Column(String, nullable=True)  # For guest orders
    customer_email = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    product_id = Column(String, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    variant_id = Column(Integer, ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)  # Snapshot at time of purchase
    size = Column(String, nullable=True)
    color = Column(String, nullable=True)
    price = Column(Float)
    quantity = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")

class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)  # 'home', 'about'
    title = Column(String)
    status = Column(String, default="draft")  # draft, published
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    sections = relationship("PageSection", back_populates="page", cascade="all, delete-orphan", order_by="PageSection.order")

class PageSection(Base):
    __tablename__ = "page_sections"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("pages.id", ondelete="CASCADE"))
    type = Column(String)  # hero, categories, products, values, instagram, newsletter
    enabled = Column(Boolean, default=True)
    order = Column(Integer, default=0)
    props = Column(JSON)  # { title: "", images: [], products: [], etc. }
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    page = relationship("Page", back_populates="sections")

class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    original_name = Column(String)
    url = Column(String)
    folder = Column(String, default="general")  # general, products, pages
    file_size = Column(Integer)  # in bytes
    mime_type = Column(String)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
