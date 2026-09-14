export const banks = [
  {
    "id": "icbc",
    "name": "中国工商银行",
    "aliases": [
      "工商银行",
      "工行",
      "ICBC"
    ]
  },
  {
    "id": "ccb",
    "name": "中国建设银行",
    "aliases": [
      "建设银行",
      "建行",
      "CCB"
    ]
  },
  {
    "id": "abc",
    "name": "中国农业银行",
    "aliases": [
      "农业银行",
      "农行",
      "ABC"
    ]
  },
  {
    "id": "boc",
    "name": "中国银行",
    "aliases": [
      "中国银行",
      "中行",
      "BOC"
    ]
  },
  {
    "id": "cmb",
    "name": "招商银行",
    "aliases": [
      "招商银行",
      "招行",
      "CMB"
    ]
  },
  {
    "id": "bocom",
    "name": "交通银行",
    "aliases": [
      "交通银行",
      "交行",
      "BCOM",
      "BOCOM"
    ]
  },
  {
    "id": "citic",
    "name": "中信银行",
    "aliases": [
      "中信银行",
      "中信",
      "CITIC"
    ]
  },
  {
    "id": "cib",
    "name": "兴业银行",
    "aliases": [
      "兴业银行",
      "兴业",
      "CIB"
    ]
  },
  {
    "id": "spdb",
    "name": "上海浦东发展银行",
    "aliases": [
      "浦发银行",
      "浦发",
      "上海浦东发展银行",
      "SPDB"
    ]
  },
  {
    "id": "cmbc",
    "name": "中国民生银行",
    "aliases": [
      "民生银行",
      "民生",
      "CMBC"
    ]
  },
  {
    "id": "ceb",
    "name": "中国光大银行",
    "aliases": [
      "光大银行",
      "光大",
      "CEB"
    ]
  },
  {
    "id": "pingan",
    "name": "平安银行",
    "aliases": [
      "平安银行",
      "平安",
      "PAB"
    ]
  },
  {
    "id": "cgb",
    "name": "广发银行",
    "aliases": [
      "广发银行",
      "广发",
      "CGB"
    ]
  },
  {
    "id": "hxb",
    "name": "华夏银行",
    "aliases": [
      "华夏银行",
      "华夏",
      "HXB"
    ]
  },
  {
    "id": "bob",
    "name": "北京银行",
    "aliases": [
      "北京银行",
      "BOB"
    ]
  },
  {
    "id": "bos",
    "name": "上海银行",
    "aliases": [
      "上海银行",
      "BOS"
    ]
  },
  {
    "id": "czb",
    "name": "浙商银行",
    "aliases": [
      "浙商银行",
      "浙商",
      "CZB"
    ]
  },
  {
    "id": "jilin",
    "name": "吉林银行",
    "aliases": [
      "吉林银行"
    ]
  },
  {
    "id": "dalian",
    "name": "大连银行",
    "aliases": [
      "大连银行"
    ]
  }
] as const;
export function bankLogo(name:string){const text=name.toUpperCase();return banks.find(bank=>bank.aliases.some(alias=>/[A-Z]/.test(alias)?new RegExp(`(^|[^A-Z])${alias}([^A-Z]|$)`).test(text):text.includes(alias)))?.id;}
