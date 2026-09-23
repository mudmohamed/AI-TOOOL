from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path, old, new, label):
    p = ROOT / path
    s = p.read_text()
    c = s.count(old)
    if c != 1:
        raise SystemExit(f'{label}: expected 1 match, found {c} in {path}')
    p.write_text(s.replace(old, new, 1))

# 1) Complete the ZIP's own one-time MATCHES migration.
p = ROOT / 'src/main.tsx'
s = p.read_text()
s = s.replace("const migrationKey = 'deriv_first_real_matches_engine_v1';", "const migrationKey = 'deriv_first_real_matches_engine_v2';")
needle = "      targetStrategy: 'MARKOV_TRANSITION',\n"
if needle not in s:
    raise SystemExit('main migration targetStrategy not found')
s = s.replace(needle, needle + "      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n", 1)
p.write_text(s)

# 2) App: use both ZIP target engines and expose the ZIP backtester.
p = ROOT / 'src/App.tsx'
s = p.read_text()
s = s.replace(
    "import { findBestAutoMatchesTarget } from './utils/autoMatchesEngine';",
    "import { findBestAutoMatchesTarget, findBestDiffersTarget } from './utils/autoMatchesEngine';",
    1,
)
if "import { StrategyBacktesterTab } from './components/StrategyBacktesterTab';" not in s:
    s = s.replace(
        "import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';",
        "import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';\nimport { StrategyBacktesterTab } from './components/StrategyBacktesterTab';",
        1,
    )

s = s.replace(
    "const [activeTab, setActiveTab] = useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN'>('SYSTEM');",
    "const [activeTab, setActiveTab] = useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN' | 'BACKTEST'>('SYSTEM');",
    1,
)

# Default/fallback is the ZIP's real MATCHES setup; an explicit saved user choice still wins.
s = s.replace("          contractMode: parsed.contractMode || 'DIFFERS',\n", "          contractMode: parsed.contractMode || 'MATCHES',\n          onlyWhenSignalConfirmed: parsed.onlyWhenSignalConfirmed ?? true,\n", 1)
s = s.replace("      contractMode: 'DIFFERS',\n", "      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n", 1)

# Recovery must remember the actual losing market/contract/target from the real settled trade.
anchor = "  const autoNextTradeRef = useRef(false);\n"
if anchor not in s:
    raise SystemExit('autoNextTradeRef anchor not found')
s = s.replace(anchor, anchor + "  const recoveryTradeRef = useRef<TradeInput | null>(null);\n", 1)

# Put exact-loss recovery before fresh scanners so next tick repeats the same market parameters.
anchor = "        if (autoMatchesActiveRef.current && symbol === currentSymbolRef.current) {\n"
recovery_block = """        if (autoNextTradeRef.current && recoveryTradeRef.current && symbol === recoveryTradeRef.current.symbol) {
          const recoveryTrade = recoveryTradeRef.current;
          const recoveryCfg = autoRecoveryConfigRef.current;
         ÛÛÝØÙ\Y^[Ý]H[X\XÛÝ\UYK^[Ý]
NÂÛÛÝ^[Ý]]HHØÙ\Y^[Ý]ÈØÙ\Y^[Ý]XÛÝ\UYKÛÛXÝ\HOOH	ÓPUÒTÉÂÈKBXÛÝ\UYKÛÛXÝ\HOOH	ÑQTÉÂÈKMBXÛÝ\PÙË^[Ý]]NÂÛÛÝØ[Ý[]YÝZÙHHØ[Ý[]S^ÝZÙJXÛÝ\PÙË\ÙTÝZÙKÙ\ÜÚ[ÛÝ]ÔYÝ\[Ý[][]]SÜÜËÙ\ÜÚ[ÛÝ]ÔYÝ\[ÛÛÙXÝ]]SÜÜÙ\Ë^[Ý]]KXÛÝ\PÙËXÛÝ\TÝ]YÞK
NÂ]]Ñ\Ü]ÚØÚÔYÝ\[HYNÂ\Ý\Ü]Ú[YTYÝ\[H]KÝÊ
NÂ[TXÙUYTYÝ\[
ÂXÛÝ\UYKÝZÙNØ[Ý[]YÝZÙK[TXÙN][ÝK[QYÚ]XÚÑYÚ]JNÂ]\ÂBY[ÚÜÝ[ÎZ\ÙHÞ\Ý[Q^]
	Ø]]ÓX]Ú\ÈØÚÈ[ÚÜÝÝ[	ÊBÈHË\XÙJ[ÚÜXÛÝ\WØØÚÈ
È[ÚÜJBÈÛÛXÝÛÛ\YYPUÒTÈØ]H[HT	ÜÈYXØ]YQTÈÚ[ÚY[\Ù][Ú[KÛHÛÛÝ\ÓX]Ú\Ó[ÙHHÙËÛÛXÝ[ÙHOOH	ÓPUÒTÉÎÂÛÛÝÛÛXÝ\HH\ÓX]Ú\Ó[ÙHÈ	ÓPUÒTÉÈ	ÑQTÉÎÂ]\Ù]YÚ]HXÚÑYÚ]ÂY
Z\ÓX]Ú\Ó[ÙJHÂ\Ù]YÚ]HÝ\[[[\Ú\ËÛÛYÚ]ÏÈNÂH[ÙHÂ]ÈHÛÛÝ\ÓX]Ú\Ó[ÙHHÙËÛÛXÝ[ÙHOOH	ÓPUÒTÉÎÂÛÛÝÛÛXÝ\HH\ÓX]Ú\Ó[ÙHÈ	ÓPUÒTÉÈ	ÑQTÉÎÂ]\Ù]YÚ]HXÚÑYÚ]ÂY
\ÓX]Ú\Ó[ÙH	ÙËÛUÚ[ÚYÛ[ÛÛ\YY	\ÚYÛ[\ÕYÙÙ\XYJHÂ]\ÂBY
Z\ÓX]Ú\Ó[ÙJHÂ\Ù]YÚ]H[\ÝY\Õ\Ù]
\]YYÚ]ËXÚÑYÚ]
K\Ù]YÚ]ÂH[ÙHÂYÛÝ[ÎZ\ÙHÞ\Ý[Q^]
	Ø]]È\Ù]ØÚÈÝÝ[	ÊBÈHË\XÙJÛ]ËJBÈ[[ÝHHÛXÛÝ\H[\[Y[][Û]Ú[ÙYX\Ù]\[Y]\ËÛHY
XÝ]PÝYÝ\[OOH	ÔÕTTÔPÓÕTIÈ	]]Ó^YTYÝ\[
HÂ6öç7B7W'&VçDæÇ62ÒÖ&¶WDæÇ6W5&Vbæ7W'&VçE·7Ö&öÅÓ°¢WFôF7F6Æö6µ&Vbæ7W'&VçBÒG'VS°¢WFôæWEG&FU&Vbæ7W'&VçBÒfÇ6S°¢Æ7DF7F6FÖU&Vbæ7W'&VçBÒFFRææ÷r° ¢6öç7B6Æ7VÆFVE7F¶RÒ6Æ7VÆFTæWE7F¶R¢À¢6W76öå7FG5&Vbæ7W'&VçBæ7V×VÆFfTÆ÷72À¢6W76öå7FG5&Vbæ7W'&VçBæ6öç6V7WFfTÆ÷76W2À¢7W'&VçDæÇ63òç&V6öÖÖVæFVD6öçG&7BÓÓÒtÔD4U2ròãR¢ãRÀ¢&V6÷fW'ÖöFP¢° ¢æFÆUÆ6UG&FU&Vbæ7W'&VçB°¢7Ö&öÂÀ¢6öçG&7EGS¢7W'&VçDæÇ63òç&V6öÖÖVæFVD6öçG&7BÇÂtDddU%2rÀ¢F&vWEfÇVS¢7W'&VçDæÇ63òç&V6öÖÖVæFVEF&vWBóòRÀ¢7F¶S¢6Æ7VÆFVE7F¶RÀ¢Ò°¢&WGW&ã°¢Ð¢"" ¦æWrÒ"""b7FfT&÷E&Vbæ7W'&VçBÓÓÒu5UU%õ$T4õdU%rbbWFôæWEG&FU&Vbæ7W'&VçBbb&V6÷fW'G&FU&Vbæ7W'&VçB°¢&WGW&ã°¢Ð¢"" ¦böÆBæ÷Bâ3 ¢&6R77FVÔWBvöÆB7WW"&V6÷fW'&Æö6²æ÷Bf÷VæBr§2Ò2ç&WÆ6RöÆBÂæWrÂ ¢26WGFÆVÖVçC¢¶VWWFòÖæWB&ÖVC²&VÖVÖ&W"W7BÆ÷72Â6ÆV"öæÇgFW"&VÂvâà¦öÆBÒ"""bWFôæWEG&FU&Vbæ7W'&VçB°¢WFôæWEG&FU&Vbæ7W'&VçBÒfÇ6S°¢Ð¢&WGW&ã°¢"" ¦æWrÒ"""bvöâ°¢&V6÷fW'G&FU&Vbæ7W'&VçBÒçVÆÃ°¢ÒVÇ6RbWFôæWEG&FU&Vbæ7W'&VçB°¢&V6÷fW'G&FU&Vbæ7W'&VçBÒ°¢7Ö&öÃ¢6WGFÆVEG&FRç7Ö&öÂÀ¢6öçG&7EGS¢6WGFÆVEG&FRæ6öçG&7EGRÀ¢F&vWEfÇVS¢6WGFÆVEG&FRçF&vWEfÇVRÀ¢7F¶S¢6WGFÆVEG&FRç7F¶RÀ¢÷WC¢6WGFÆVEG&FRç÷WBÀ¢VçG'&6S¢6WGFÆVEG&FRæWE&6RÀ¢VçG'FvC¢6WGFÆVEG&FRæWDFvBÀ¢Ó°¢6WDWFõ&V6÷fW'æ÷F6RÆ÷72öâG·6WGFÆVEG&FRç7Ö&öÇÒâ6ÖRG·6WGFÆVEG&FRæ6öçG&7EGWÒF&vWBG·6WGFÆVEG&FRçF&vWEfÇVWÒ&ÖVBf÷"FRæWB&VÂFW&bF6²æ°¢Ð¢&WGW&ã°¢"" ¦böÆBæ÷Bâ3 ¢&6R77FVÔWBw6WGFÆVÖVçBWFôæWB&Æö6²æ÷Bf÷VæBr§2Ò2ç&WÆ6RöÆBÂæWrÂ ¢27F÷÷&W6WB×W7BÇ6ò6ÆV"VæFærW7BÖÆ÷72&V6÷fW'à§2Ò2ç&WÆ6R¢"WFôæWEG&FU&Vbæ7W'&VçBÒfÇ6SµÆâWFôF7F6Æö6µ&Vbæ7W'&VçBÒfÇ6S²"À¢"WFôæWEG&FU&Vbæ7W'&VçBÒfÇ6SµÆâ&V6÷fW'G&FU&Vbæ7W'&VçBÒçVÆÃµÆâWFôF7F6Æö6µ&Vbæ7W'&VçBÒfÇ6S²"À¢À¢§2Ò2ç&WÆ6R¢"6WDÆ7E6WGFÆVEG&FRçVÆÂµÆâ"À¢"6WDÆ7E6WGFÆVEG&FRçVÆÂµÆâ&V6÷fW'G&FU&Vbæ7W'&VçBÒçVÆÃµÆâ"À¢À¢ ¢2FB&6·FW7FW"F"Ç&VG&W6VçBâ¤'WB&Wf÷W6ÇVç&V6&ÆRà§F%öæ6÷"Ò"²u$T4õdU%rÂu&V6÷fW'7G&FVwrÂ6VÆD6V6µÒÅÆâ ¦bF%öæ6÷"æ÷Bâ3 ¢&6R77FVÔWBwF"æ6÷"æ÷Bf÷VæBr§2Ò2ç&WÆ6RF%öæ6÷"ÂF%öæ6÷"²"²t$4µDU5BrÂuvææær6WGW&6·FW7FW"rÂ7FfGÒÅÆâ"Â ¢2v&RÖçVÂFvB'WGFöç2çFòÆfR6öæfrà¦öÆBÒ"""6×ÆU6¦S×·6×ÆU6¦WÐ¢öå6×ÆU6¦T6ævS×·6WE6×ÆU6¦WÐ¢óà¢"" ¦æWrÒ"""6×ÆU6¦S×·6×ÆU6¦WÐ¢öå6×ÆU6¦T6ævS×·6WE6×ÆU6¦WÐ¢öå6VÆV7EF&vWDFvC×²FvBÂGRÓâ°¢6öç7BæWD6öæfs¢WFôÖF6W46öæfrÒ°¢ââæWFôÖF6W46öæfu&Vbæ7W'&VçBÀ¢6öçG&7DÖöFS¢GRÀ¢F&vWE7G&FVw¢t5U5DôÒrÀ¢7W7FöÕF&vWDFvC¢FvBÀ¢Ó°¢6WDWFôÖF6W46öæfræWD6öæfr°¢WFôÖF6W46öæfu&Vbæ7W'&VçBÒæWD6öæfs°¢G'²Æö6Å7F÷&vRç6WDFVÒvFW&eöWFõöÖF6W5ö6öæfrrÂ¥4ôâç7G&ævgæWD6öæfr²Ò6F6·Ð¢6÷tæ÷F6RG·GWÒF&vWBFvBG¶FvGÒÆöFVBçFòFR&VÂWFòG&FW"æ°¢×Ð¢óà¢"" ¦böÆBæ÷Bâ3 ¢&6R77FVÔWBtÖF6W4FvDæÇ¦W"&÷2æ6÷"æ÷Bf÷VæBr§2Ò2ç&WÆ6RöÆBÂæWrÂ ¢2&VæFW"æB6öææV7BFR¤w27G&FVw&6·FW7FW"Ç×FòÔÆfRFà¦æ6÷"Ò"""²7FfUF"ÓÓÒu55DTÒrÇÂ7FfUF"ÓÓÒtõdU%dUrrÇÂ7FfUF"ÓÓÒu$T4õdU%rbb¢Å7WW%&V6÷fW'ÖævW ¢"" ¦&6·FW7E÷&VæFW"Ò"""¶7FfUF"ÓÓÒt$4µDU5Brbb¢Å7G&FVw&6·FW7FW%F ¢7W'&VçE7Ö&öÃ×¶7W'&VçE7Ö&öÇÐ¢Ö&¶WEF6·3×¶Ö&¶WEF6´FF&Vbæ7W'&VçGÐ¢öäÇ7G&FVwFôÆfT&÷C×²'FÂÓâ°¢6öç7BæWD6öæfs¢WFôÖF6W46öæfrÒ²ââæWFôÖF6W46öæfu&Vbæ7W'&VçBÂââç'FÂÓ°¢6WDWFôÖF6W46öæfræWD6öæfr°¢WFôÖF6W46öæfu&Vbæ7W'&VçBÒæWD6öæfs°¢G'²Æö6Å7F÷&vRç6WDFVÒvFW&eöWFõöÖF6W5ö6öæfrrÂ¥4ôâç7G&ævgæWD6öæfr²Ò6F6·Ð¢6÷tæ÷F6Rt&6·FW7FVB6WGWÆöFVBçFòFR&VÂWFòG&FW"âr°¢×Ð¢öäæfvFUFõG&FW#×²Óâ6WD7FfUF"tDTUõ44ârÐ¢óà¢Ð ¢"" ¦bæ6÷"æ÷Bâ3 ¢&6R77FVÔWBw&V6÷fW'&VæFW"æ6÷"æ÷Bf÷VæBr§2Ò2ç&WÆ6Ræ6÷"Â&6·FW7E÷&VæFW"²æ6÷"Â ¢2F7ÆFR6ÖRF&vWBFRÆfRWFò&÷Bv÷VÆB7GVÆÇW6RÂæ÷BÇv2÷DFvBà¦æ6÷"Ò"6öç7B7W'&VçD&Ææ6RÒÆfT&Ææ6SµÆåÆâ&WGW&âÆâ ¦6Æ2Ò"""6öç7B7W'&VçDWFõ6væÂÒ7W'&VçDæÇ60¢òfæD&W7DWFôÖF6W5F&vWB¢7W'&VçE7Ö&öÂÀ¢7W'&VçDæÇ62æF7ÆæÖRÀ¢FvG2À¢7W'&VçDæÇ62æFvE7FG2À¢Æ7DFvBÀ¢¢¢çVÆÃ°¢6öç7B7W'&VçDFffW'5F&vWBÒfæD&W7DFffW'5F&vWBFvG2ÂÆ7DFvBçF&vWDFvC°¢6öç7BF7ÆVDWFõF&vWBÒWFôÖF6W46öæfræ6öçG&7DÖöFRÓÓÒtÔD4U2p¢òWFôÖF6W46öæfræ7W7FöÕF&vWDFvBÓÒVæFVfæV@¢òWFôÖF6W46öæfræ7W7FöÕF&vWDFv@¢¢WFôÖF6W46öæfrçF&vWE7G&FVwÓÓÒtÔ$´õeõE$å4Dôâp¢ò7W'&VçDWFõ6væÃòçF&vWDFvBóò7W'&VçDæÇ63òæ÷DFv@¢¢WFôÖF6W46öæfrçF&vWE7G&FVwÓÓÒu$UTEôTåE%p¢òÆ7DFv@¢¢7W'&VçDæÇ63òæ÷DFv@¢¢7W'&VçDFffW'5F&vWC° ¢"" ¦bæ6÷"æ÷Bâ3 ¢&6R77FVÔWBv7W'&VçD&Ææ6R&WGW&âæ6÷"æ÷Bf÷VæBr§2Ò2ç&WÆ6Ræ6÷"Â"6öç7B7W'&VçD&Ææ6RÒÆfT&Ææ6SµÆåÆâ"²6Æ2²"&WGW&âÆâ"Â§2Ò2ç&WÆ6R"F&vWDFvC×¶7W'&VçDæÇ63òæ÷DFvGÕÆâ"Â"F&vWDFvC×¶F7ÆVDWFõF&vWGÕÆâ"Â §çw&FU÷FWB2 ¢22'VÆ²ÔD4U2ôDddU%2vfW2×W7BW6RFR6ÖR¤F&vWBVævæW22FRÖâ&÷Bà§Ò$ôõBòw7&2ö6ö×öæVçG2ô'VÆ´×VÇFG&FW"çG7p§2Òç&VE÷FWB¦×÷'Eöæ6÷"Ò&×÷'B&V7BÂ²W6U7FFRÂW6TVffV7BÂW6U&VbÂW6TÖVÖòÒg&öÒw&V7BsµÆâ ¦b×÷'Eöæ6÷"â2æB"ââ÷WFÇ2öWFôÖF6W4VævæR"æ÷Bâ3 ¢2Ò2ç&WÆ6R×÷'Eöæ6÷"Â×÷'Eöæ6÷"²&×÷'B²fæD&W7DWFôÖF6W5F&vWBÂfæD&W7DFffW'5F&vWBÒg&öÒrââ÷WFÇ2öWFôÖF6W4VævæRsµÆâ"Â ¦öÆBÒ"""b6öæfrç7G&FVwÓÓÒuTÅE$ôDddU%5õtdRr°¢òòfæB6öÆFW7BFvBvFÆ&vW7BFVÆ¢6öç7B6öÆFW7BÒFVÒæFvE7FG2ç&VGV6RÖâÂ7W"Óâ7W"çW&6VçFvRÂÖâçW&6VçFvRò7W"¢ÖâÂFVÒæFvE7FG5³Ò°¢&V6öÖÖVæFVD6öçG&7BÒtDddU%2s°¢&V6öÖÖVæFVEF&vWBÒ6öÆFW7Bò6öÆFW7BæFvB¢FVÒæ6öÆDFvC°¢66÷&RÒ6öÆFW7BòÖFæÖâbÂÖFæÖsÂÖFç&÷VæBÒ6öÆFW7BçW&6VçFvR¢ã²6öÆFW7BæFVÆâRò¢¢S°¢&FöæÆRÒ6öÆFW7BFvB2G·&V6öÖÖVæFVEF&vWGÒöæÇG¶6öÆFW7CòçW&6VçFvRçFôfVBÒRg&WÂFVÆG¶6öÆFW7CòæFVÆÇÂÒF6·2°¢"" ¦æWrÒ"""b6öæfrç7G&FVwÓÓÒuTÅE$ôDddU%5õtdRr°¢6öç7BFvG2ÒÖ&¶WEF6·5¶FVÒç7Ö&öÅÓòæFvG2ÇÂµÓ°¢6öç7BFffW'2ÒfæD&W7DFffW'5F&vWBFvG2ÂFVÒæÆ7DFvB°¢&V6öÖÖVæFVD6öçG&7BÒtDddU%2s°¢&V6öÖÖVæFVEF&vWBÒFffW'2çF&vWDFvC°¢66÷&RÒÖFç&÷VæBFffW'2çvå&ö&&ÆG°¢&FöæÆRÒvâ6VÆBF&vWB2G·&V6öÖÖVæFVEF&vWGÒG¶FffW'2æFvDg&WVVæ7çFôfVBÒRö'6W'fVBg&WVVæ7ÂFVÆG¶FffW'2æFVÆÒF6·2°¢"" ¦böÆBæ÷Bâ3 ¢&6R77FVÔWBv'VÆ²FffW'2&Æö6²æ÷Bf÷VæBr§2Ò2ç&WÆ6RöÆBÂæWrÂ ¦öÆBÒ"""ÒVÇ6Rb6öæfrç7G&FVwÓÓÒtÔD4U5õ4äU%õtdRr°¢6öç7B÷GFW7BÒFVÒæFvE7FG2ç&VGV6RÖÂ7W"Óâ7W"çW&6VçFvRâÖçW&6VçFvRò7W"¢ÖÂFVÒæFvE7FG5³Ò°¢&V6öÖÖVæFVD6öçG&7BÒtÔD4U2s°¢&V6öÖÖVæFVEF&vWBÒ÷GFW7Bò÷GFW7BæFvB¢FVÒæ÷DFvC°¢66÷&RÒ÷GFW7BòÖFç&÷VæB÷GFW7BçW&6VçFvR¢BãR²#¢c°¢&FöæÆRÒ÷B6ÇW7FW"FvB2G·&V6öÖÖVæFVEF&vWGÒããW÷WB6æW"°¢Ð¢"" ¦æWrÒ"""ÒVÇ6Rb6öæfrç7G&FVwÓÓÒtÔD4U5õ4äU%õtdRr°¢6öç7BFvG2ÒÖ&¶WEF6·5¶FVÒç7Ö&öÅÓòæFvG2ÇÂµÓ°¢6öç7B6væÂÒfæD&W7DWFôÖF6W5F&vWB¢FVÒç7Ö&öÂÀ¢FVÒæF7ÆæÖRÀ¢FvG2À¢FVÒæFvE7FG2À¢FVÒæÆ7DFvBÀ¢°¢&V6öÖÖVæFVD6öçG&7BÒtÔD4U2s°¢&V6öÖÖVæFVEF&vWBÒ6væÂçF&vWDFvC°¢66÷&RÒÖFç&÷VæB6væÂç&ö&&ÆG66÷&R°¢&FöæÆRÒ6væÂç&FöæÆS°¢Ð¢"" ¦böÆBæ÷Bâ3 ¢&6R77FVÔWBv'VÆ²ÖF6W2&Æö6²æ÷Bf÷VæBr§2Ò2ç&WÆ6RöÆBÂæWrÂ§çw&FU÷FWB2 §&çBvgVÆÂ¤ÖF6ær÷vâv&ærF6ÆVBrÿÿÿ