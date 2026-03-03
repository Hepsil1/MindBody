# Order Schemas for /orders endpoint
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class OrderItemCreate(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int
    size: Optional[str] = None
    color: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    delivery_city: str
    delivery_address: str
    payment_method: str = 'cash_on_delivery'
    total_amount: float
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    id: int
    order_number: str
    status: str
    total_amount: float
    created_at: datetime
    
    class Config:
        from_attributes = True
