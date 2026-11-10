-- Explicit demo catalog only. No fake accounts, pets, orders or AI conversations.
insert into public.products(id,name,category,price,image_key,is_demo) values
 ('snack','三文鱼冻干小零食','snack',39.90,'goods-snack',true),
 ('toy','奶黄毛绒逗猫棒套装','toy',29.90,'goods-toy',true),
 ('bed','云朵形安睡宠物窝','care',129.00,'goods-bed',true),
 ('carrier','透明太空舱外出背包','travel',159.00,'goods-carrier',true),
 ('catfood','PawsUp 严选鲜肉无谷猫粮','snack',139.00,'goods-catfood',true)
on conflict(id) do nothing;
