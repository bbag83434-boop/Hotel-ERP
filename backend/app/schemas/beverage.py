from datetime import datetime
from pydantic import BaseModel, Field
class BeverageItemCreate(BaseModel):
    branch_id:str; code:str=Field(min_length=1,max_length=80); name:str; category:str; beverage_type:str='BEVERAGE'; unit:str='bottle'; pack_size:float=1; cost_price:float=0; selling_price:float=0; notes:str|None=None
class BeverageItemResponse(BeverageItemCreate):
    id:str; active:bool; stock:float
class BeverageTxnCreate(BaseModel):
    branch_id:str; item_id:str; txn_type:str; quantity:float=Field(gt=0); reference:str|None=None; notes:str|None=None
class BeverageLedgerResponse(BaseModel):
    id:str; item_id:str; item_name:str; txn_type:str; quantity:float; reference:str|None=None; notes:str|None=None; created_at:datetime
class BeverageSummary(BaseModel):
    items:int; alcohol_items:int; total_stock:float; low_stock_items:int; today_sales:float; today_wastage:float
