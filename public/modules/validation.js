// SalesLedger — 客户端校验（仅 UX，服务端为唯一真值）

export function validateForm(input) {
  const errors = {};

  if (!input.date) errors.date = '请选择日期';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.date = '日期格式错误';

  if (!input.product || !input.product.trim()) errors.product = '请输入商品名称';
  else if (input.product.length > 200) errors.product = '商品名过长';

  if (!input.channel) errors.channel = '请选择渠道';

  if (input.cost == null || isNaN(input.cost) || input.cost < 0) errors.cost = '成本不能为负';

  if (input.price == null || isNaN(input.price) || input.price <= 0) errors.price = '售价必须大于 0';
  else if (input.cost != null && input.price < input.cost) errors.price = '售价不能低于成本';

  if (input.note && input.note.length > 500) errors.note = '备注过长';

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}
