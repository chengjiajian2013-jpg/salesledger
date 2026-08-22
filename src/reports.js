import { strToU8, zipSync } from 'fflate';

const CHANNEL_LABELS = {
  quota: '换货',
  direct: '直款',
  recovery: '回收',
  other: '其他',
};

const COMPANY_HEADERS = [
  '售出日期', '品牌', '型号', '成本', '小助理换货金额', '售出价', '售货渠道',
  '实际到账情况', '换货提成 2%', '直款提成（利润 10%）', '直客回收 40%',
];

const PERSONAL_HEADERS = ['日期', '品牌', '商品', '渠道', '成本', '售价', '佣金率', '利润', '备注'];

export function getReportPeriod(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''))) {
    throw new Error('month 必须是 YYYY-MM 格式');
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    month,
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildCompanyReportRows(rows = []) {
  return rows.map(row => {
    const channel = row.channel || 'other';
    const cost = roundInteger(row.cost);
    const price = roundInteger(row.price);
    const rate = Number(row.commission_rate) || 0;
    const isQuota = channel === 'quota';
    const quotaAmount = isQuota ? price : null;
    return {
      date: cleanText(row.date),
      brand: cleanText(row.brand),
      product: cleanText(row.product),
      cost: isQuota ? null : cost,
      quotaAmount,
      price: isQuota ? null : price,
      channel: CHANNEL_LABELS[channel] || cleanText(channel),
      account: cleanText(row.account),
      quotaCommission: isQuota ? roundInteger(price * rate) : 0,
      directCommission: channel === 'direct' ? roundInteger(Math.max(price - cost, 0) * rate) : 0,
      recoveryCommission: channel === 'recovery' ? roundInteger(Math.max(price - cost, 0) * rate) : 0,
    };
  });
}

export function buildPersonalReportRows(rows = []) {
  return rows.map(row => ({
    date: cleanText(row.date),
    brand: cleanText(row.brand),
    product: cleanText(row.product),
    channel: CHANNEL_LABELS[row.channel] || cleanText(row.channel),
    cost: roundInteger(row.cost),
    price: roundInteger(row.price),
    commissionRate: roundInteger((Number(row.commission_rate) || 0) * 100),
    profit: roundInteger(row.profit),
    note: cleanText(row.note),
  }));
}

export function buildCompanyFooter(totals) {
  const values = totals.map(roundInteger);
  return {
    labels: COMPANY_HEADERS.slice(8),
    values,
    grandTotal: values.reduce((sum, value) => sum + value, 0),
    merge: 'I:K',
  };
}

export function buildReportWorkbook(ledger, rows, month) {
  if (ledger === 'company') return buildCompanyWorkbook(rows, month);
  if (ledger === 'personal') return buildPersonalWorkbook(rows, month);
  throw new Error('ledger 必须是 company 或 personal');
}

export function buildCompanyWorkbook(rows, month) {
  const data = buildCompanyReportRows(rows);
  const totals = [
    data.reduce((sum, row) => sum + row.quotaCommission, 0),
    data.reduce((sum, row) => sum + row.directCommission, 0),
    data.reduce((sum, row) => sum + row.recoveryCommission, 0),
  ];
  const footer = buildCompanyFooter(totals);
  const body = [
    ['公司账本 - ' + month.replace('-', '年') + '月'],
    COMPANY_HEADERS,
    ...data.map(row => [row.date, row.brand, row.product, row.cost, row.quotaAmount, row.price, row.channel, row.account, row.quotaCommission, row.directCommission, row.recoveryCommission]),
    ['', '', '', '', '', '', '', '提成项目', ...footer.labels],
    ['', '', '', '', '', '', '', '总计', footer.grandTotal],
  ];
  return createXlsx('公司账本', body, {
    mergeRanges: [`A1:K1`, `I${body.length}:K${body.length}`],
    widths: [14, 16, 24, 12, 18, 12, 12, 28, 16, 20, 16],
    titleRow: 1,
    headerRow: 2,
    footerHeaderRow: body.length - 1,
    footerTotalRow: body.length,
    numberColumns: [4, 5, 6, 9, 10, 11],
  });
}

export function buildPersonalWorkbook(rows, month) {
  const data = buildPersonalReportRows(rows);
  const body = [
    ['个人账本 - ' + month.replace('-', '年') + '月'],
    PERSONAL_HEADERS,
    ...data.map(row => [row.date, row.brand, row.product, row.channel, row.cost, row.price, `${row.commissionRate}%`, row.profit, row.note]),
  ];
  return createXlsx('个人账本', body, {
    mergeRanges: [`A1:I1`],
    widths: [14, 16, 24, 12, 12, 12, 12, 12, 28],
    titleRow: 1,
    headerRow: 2,
    numberColumns: [5, 6, 8],
  });
}

export async function handleReportExport(request, env) {
  const url = new URL(request.url);
  let period;
  try {
    period = getReportPeriod(url.searchParams.get('month'));
  } catch (error) {
    return Response.json({ error: { code: 'INVALID_QUERY', message: error.message } }, { status: 400 });
  }
  const ledger = url.searchParams.get('ledger');
  if (!['company', 'personal'].includes(ledger)) {
    return Response.json({ error: { code: 'INVALID_QUERY', message: 'ledger 必须是 company 或 personal' } }, { status: 400 });
  }
  const rows = await env.DB.prepare(`
    SELECT brand, date, product, channel, cost, price, commission_rate, profit, account, note
    FROM transactions
    WHERE seller = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, id ASC
  `).bind(ledger, period.startDate, period.endDate).all();
  const bytes = buildReportWorkbook(ledger, rows.results || [], period.month);
  const name = `${ledger === 'company' ? '公司账本' : '个人账本'}-${period.month}.xlsx`;
  const asciiName = `${ledger === 'company' ? 'company-ledger' : 'personal-ledger'}-${period.month}.xlsx`;
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}

function createXlsx(sheetName, rows, options) {
  const sheet = buildSheetXml(rows, options);
  const files = {
    '[Content_Types].xml': strToU8(contentTypesXml()),
    '_rels/.rels': strToU8(rootRelsXml()),
    'xl/workbook.xml': strToU8(workbookXml(sheetName)),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRelsXml()),
    'xl/styles.xml': strToU8(stylesXml()),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
}

function buildSheetXml(rows, options) {
  const xmlRows = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 1;
    const isTitle = excelRow === options.titleRow;
    const isHeader = excelRow === options.headerRow || excelRow === options.footerHeaderRow;
    const isFooterTotal = excelRow === options.footerTotalRow;
    const cells = row.map((value, columnIndex) => {
      if (isFooterTotal && columnIndex === 9) return '';
      const ref = `${columnName(columnIndex + 1)}${excelRow}`;
      const style = isTitle ? 3 : isHeader ? 2 : isFooterTotal ? 4 : 0;
      return xmlCell(ref, value, style, options.numberColumns?.includes(columnIndex + 1));
    }).join('');
    return `<row r="${excelRow}">${cells}</row>`;
  }).join('');
  const merges = (options.mergeRanges || []).map(range => `<mergeCell ref="${range}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${columnName(options.widths.length)}${rows.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="20"/><cols>${options.widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xmlRows}</sheetData><mergeCells count="${options.mergeRanges.length}">${merges}</mergeCells>
<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function xmlCell(ref, value, style, numeric) {
  if (value === null || value === undefined || value === '') return '';
  if (numeric && typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xmlEscape(value)}</t></is></c>`;
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function columnName(number) {
  let result = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}

function cleanText(value) {
  return value == null || String(value).includes('\ufffd') ? '' : String(value);
}

function roundInteger(value) {
  return Math.round(Number(value) || 0);
}

function contentTypesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
}

function rootRelsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
}

function workbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`;
}

function workbookRelsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
}

function stylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="4" formatCode="0"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Microsoft YaHei"/></font><font><b/><sz val="10"/><name val="Microsoft YaHei"/></font><font><b/><sz val="14"/><name val="Microsoft YaHei"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F0E8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7C46A"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="4" fontId="0" fillId="0" borderId="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0"/><xf numFmtId="4" fontId="1" fillId="2" borderId="1" applyNumberFormat="1"/></cellXfs></styleSheet>';
}
