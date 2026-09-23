from pathlib import Path
R=Path(__file__).resolve().parents[1]
def f(p): return (R/p).read_text()
def w(p,s): (R/p).write_text(s)
def one(s,a,b,n):
 c=s.count(a)
 if c!=1: raise SystemExit(f'{n}: {c}')
 return s.replace(a,b,1)

p='src/main.tsx'; s=f(p)
s=one(s,"const migrationKey = 'deriv_first_real_matches_engine_v1';","const migrationKey = 'deriv_first_real_matches_engine_v2';",'migration key')
s=one(s,"      targetStrategy: 'MARKOV_TRANSITION',\n","      targetStrategy: 'MARKOV_TRANSITION',\n      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n",'migration config'); w(p,s)

p='src/App.tsx'; s=f(p)
s=one(s,"import { findBestAutoMatchesTarget } from './utils/autoMatchesEngine';","import { findBestAutoMatchesTarget, findBestDiffersTarget } from './utils/autoMatchesEngine';",'engine import')
s=one(s,"import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';","import { AutoTradingSystemHero } from './components/AutoTradingSystemHero';\nimport { StrategyBacktesterTab } from './components/StrategyBacktesterTab';",'backtester import')
s=one(s,"useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN'>('SYSTEM')","useState<'SYSTEM' | 'OVERVIEW' | 'BULK' | 'MATCHES' | 'RECOVERY' | 'SCANNER' | 'DEEP_SCAN' | 'BACKTEST'>('SYSTEM')",'tab type')
s=one(s,"          contractMode: parsed.contractMode || 'DIFFERS',\n","          contractMode: parsed.contractMode || 'MATCHES',\n          onlyWhenSignalConfirmed: parsed.onlyWhenSignalConfirmed ?? true,\n",'saved default')
s=one(s,"      contractMode: 'DIFFERS',\n","      contractMode: 'MATCHES',\n      onlyWhenSignalConfirmed: true,\n",'fresh default')
s=one(s,"  const autoNextTradeRef = useRef(false);\n","  const autoNextTradeRef = useRef(false);\n  const recoveryTradeRef = useRef<TradeInput | null>(null);\n",'recovery ref')

A="        if (autoMatchesActiveRef.current && symbol === currentSymbolRef.current) {\n"
B="""        if (autoNextTradeRef.current && recoveryTradeRef.current && symbol === recoveryTradeRef.current.symbol) {
          const rt = recoveryTradeRef.current;
          const rc = autoRecoveryConfigRef.current;
          const observed = Number(rt.payout || 0);
          const rate = observed > 0 ? observed : rt.contractType === 'MATCHES' ? 9.5 : rt.contractType === 'DIFFERS' ? 1.095 : rc.payoutRate;
          const stake = calculateNextStake(rc.baseStake, sessionStatsRef.current.cumulativeLoss, sessionStatsRef.current.consecutiveLosses, rate, rc.recoveryStrategy);
          autoDispatchLockRef.current = true;
          lastDispatchTimeRef.current = Date.now();
          handlePlaceTradeRef.current({ ...rt, stake, entryPrice: quote, entryDigit: tickDigit });
          return;
        }

"""+A
s=one(s,A,B,'recovery priority')
A="""          const isMatchesMode = cfg.contractMode === 'MATCHES';
          const contractType = isMatchesMode ? 'MATCHES' : 'DIFFERS';
          let targetDigit = tickDigit;

          if (!isMatchesMode) {
            targetDigit = currentAnalysis.coldDigit ?? 5;
          } else {
"""
B="""          const isMatchesMode = cfg.contractMode === 'MATCHES';
          const contractType = isMatchesMode ? 'MATCHES' : 'DIFFERS';
          let targetDigit = tickDigit;
          if (isMatchesMode && cfg.onlyWhenSignalConfirmed && !signal.isTriggerReady) return;
          if (!isMatchesMode) {
            targetDigit = findBestDiffersTarget(updatedDigits, tickDigit).targetDigit;
          } else {
"""
s=one(s,A,B,'live target wiring')
A="""        if (activeBotRef.current === 'SUPER_RECOVERY' && autoNextTradeRef.current) {
         ÛÛÝÝ\[[[\Ú\ÈHX\Ù][[\Ù\ÔYÝ\[ÜÞ[XÛNÂ]]Ñ\Ü]ÚØÚÔYÝ\[HYNÂ]]Ó^YTYÝ\[H[ÙNÂ\Ý\Ü]Ú[YTYÝ\[H]KÝÊ
NÂÛÛÝØ[Ý[]YÝZÙHHØ[Ý[]S^ÝZÙJKÙ\ÜÚ[ÛÝ]ÔYÝ\[Ý[][]]SÜÜËÙ\ÜÚ[ÛÝ]ÔYÝ\[ÛÛÙXÝ]]SÜÜÙ\ËÝ\[[[\Ú\ÏËXÛÛ[Y[YÛÛXÝOOH	ÓPUÒTÉÈÈKHKMKXÛÝ\S[ÙB
NÂ[TXÙUYTYÝ\[
ÂÞ[XÛÛÛXÝ\NÝ\[[[\Ú\ÏËXÛÛ[Y[YÛÛXÝ	ÑQTÉË\Ù][YNÝ\[[[\Ú\ÏËXÛÛ[Y[Y\Ù]ÏÈKÝZÙNØ[Ý[]YÝZÙKJNÂ]\ÂBÏ[ÛJËKY
XÝ]PÝYÝ\[OOH	ÔÕTTÔPÓÕTIÈ	]]Ó^YTYÝ\[	\XÛÝ\UYTYÝ\[
H]\×	ÛÛXÛÝ\IÊBOHY
]]Ó^YTYÝ\[
HÂ]]Ó^YTYÝ\[H[ÙNÂB]\ÂHY
ÛÛHXÛÝ\UYTYÝ\[H[Â[ÙHY
]]Ó^YTYÝ\[
HÂXÛÝ\UYTYÝ\[HÈÞ[XÛÙ]YYKÞ[XÛÛÛXÝ\NÙ]YYKÛÛXÝ\K\Ù][YNÙ]YYK\Ù][YKÝZÙNÙ]YYKÝZÙK^[Ý]Ù]YYK^[Ý][TXÙNÙ]YYK^]XÙK[QYÚ]Ù]YYK^]YÚ]NÂÙ]]]ÔXÛÝ\SÝXÙJÜÜÈÛ	ÜÙ]YYKÞ[XÛKØ[YH	ÜÙ]YYKÛÛXÝ\_H\Ù]	ÜÙ]YYK\Ù][Y_H\YYÜH^X[\]XÚË
NÂB]\ÂÏ[ÛJËK	ÜÙ][Y[XÛÝ\IÊBÏ[ÛJË]]Ó^YTYÝ\[H[ÙN×]]Ñ\Ü]ÚØÚÔYÝ\[H[ÙNÈ]]Ó^YTYÝ\[H[ÙN×XÛÝ\UYTYÝ\[H[×]]Ñ\Ü]ÚØÚÔYÝ\[H[ÙNÈ	ÜÝÜÛX\ÊBÏ[ÛJËÙ]\ÝÙ]YYJ[
N×Ù]\ÝÙ]YYJ[
N×XÛÝ\UYTYÝ\[H[×	Ü\Ù]ÛX\ÊBÏ[ÛJËÉÔPÓÕTIË	ÔXÛÝ\HÝ]YÞIËÚY[ÚXÚ×KÉÔPÓÕTIË	ÔXÛÝ\HÝ]YÞIËÚY[ÚXÚ×KÉÐPÒÕTÕ	Ë	ÕÚ[[ÈÙ]\XÚÝ\Ý\ËXÝ]]WK	ÝX]ÛÊBOHØ[\TÚ^O^ÜØ[\TÚ^_BÛØ[\TÚ^PÚ[ÙO^ÜÙ]Ø[\TÚ^_BÏHØ[\TÚ^O^ÜØ[\TÚ^_BÛØ[\TÚ^PÚ[ÙO^ÜÙ]Ø[\TÚ^_BÛÙ[XÝ\Ù]YÚ]^ÊYÚ]\JHOÂÛÛÝ]]ÓX]Ú\ÐÛÛYÈHÈ]]ÓX]Ú\ÐÛÛYÔYÝ\[ÛÛXÝ[ÙN\K\Ù]Ý]YÞN	ÐÕTÕÓIËÝ\ÝÛU\Ù]YÚ]YÚ]NÂÙ]]]ÓX]Ú\ÐÛÛYÊNÈ]]ÓX]Ú\ÐÛÛYÔYÝ\[HÂHÈØØ[ÝÜYÙKÙ]][J	Ù\]Ø]]×ÛX]Ú\×ØÛÛYÉËÓÓÝ[ÚYJJNÈHØ]ÚßBÚÝÓÝXÙJ	Ý\_H\Ù]YÚ]	ÙYÚ]HØYY[ÈHX[]]ÈY\
NÂ_BÏÏ[ÛJËK	ÛX[X[\Ù]	ÊBOHÊXÝ]UXOOH	ÔÖTÕSIÈXÝ]UXOOH	ÓÕTQUÉÈXÝ]UXOOH	ÔPÓÕTIÊH	
Ý\\XÛÝ\SX[YÙ\HØXÝ]UXOOH	ÐPÒÕTÕ	È	
Ý]YÞPXÚÝ\Ý\XÝ\[Þ[XÛ^ØÝ\[Þ[XÛHX\Ù]XÚÜÏ^ÛX\Ù]XÚÑ]TYÝ\[BÛ\TÝ]YÞUÓ]PÝ^Ê\X[
HOÂÛÛÝ]]ÓX]Ú\ÐÛÛYÈHÈ]]ÓX]Ú\ÐÛÛYÔYÝ\[\X[NÂÙ]]]ÓX]Ú\ÐÛÛYÊNÈ]]ÓX]Ú\ÐÛÛYÔYÝ\[HÂHÈØØ[ÝÜYÙKÙ]][J	Ù\]Ø]]×ÛX]Ú\×ØÛÛYÉËÓÓÝ[ÚYJJNÈHØ]ÚßBÚÝÓÝXÙJ	ÐXÚÝ\ÝYÙ]\ØYY[ÈHX[]]ÈY\ÊNÂ_HÛ]YØ]UÕY\^Ê
HOÙ]XÝ]UX	ÑQTÔÐÐSÊ_HÏ
_BÐBÏ[ÛJËK	ØXÚÝ\Ý\[\ÊBOHÛÛÝÝ\[[[ÙHH]P[[ÙN×]\
HÛÛÝÝ\[[[ÙHH]P[[ÙNÂÛÛÝÝ\[]]ÔÚYÛ[HÝ\[[[\Ú\ÈÈ[\Ý]]ÓX]Ú\Õ\Ù]
Ý\[Þ[XÛÝ\[[[\Ú\Ë\Ü^S[YKYÚ]ËÝ\[[[\Ú\ËYÚ]Ý]Ë\ÝYÚ]
H[ÂÛÛÝÝ\[Y\Õ\Ù]H[\ÝY\Õ\Ù]
YÚ]Ë\ÝYÚ]
K\Ù]YÚ]ÂÛÛÝ\Ü^YY]]Õ\Ù]H]]ÓX]Ú\ÐÛÛYËÛÛXÝ[ÙHOOH	ÓPUÒTÉÂÈ]]ÓX]Ú\ÐÛÛYËÝ\ÝÛU\Ù]YÚ]OOH[Y[YÈ]]ÓX]Ú\ÐÛÛYËÝ\ÝÛU\Ù]YÚ]]]ÓX]Ú\ÐÛÛYË\Ù]Ý]YÞHOOH	ÓPTÓÕÕSÒUSÓÈÈÝ\[]]ÔÚYÛ[Ë\Ù]YÚ]ÏÈÝ\[[[\Ú\ÏËÝYÚ]]]ÓX]Ú\ÐÛÛYË\Ù]Ý]YÞHOOH	ÔTPUÑSIÈÈ\ÝYÚ]Ý\[[[\Ú\ÏËÝYÚ]Ý\[Y\Õ\Ù]Â]\
Ï[ÛJËK	Ù\Ü^H\Ù]	ÊBÏ[ÛJË\Ù]YÚ]^ØÝ\[[[\Ú\ÏËÝYÚ]W\Ù]YÚ]^Ù\Ü^YY]]Õ\Ù]W	ÙØ][È\Ù]	ÊBÊÊBIÜÜËØÛÛ\Û[ËÐ[Ó][UY\Þ	ÎÈÏY
BÏ[ÛJË[\ÜXXÝÈ\ÙTÝ]K\ÙQYXÝ\ÙTY\ÙSY[[ÈHÛH	ÜXXÝ	Î×[\ÜXXÝÈ\ÙTÝ]K\ÙQYXÝ\ÙTY\ÙSY[[ÈHÛH	ÜXXÝ	Î×[\ÜÈ[\Ý]]ÓX]Ú\Õ\Ù][\ÝY\Õ\Ù]HÛH	ËÝ][ËØ]]ÓX]Ú\Ñ[Ú[IÎ×	Ø[È[\Ü	ÊBOHY
ÛÛYËÝ]YÞHOOH	ÕSWÑQT×ÕÐUIÊHÂËÈ[ÛÛ\ÝYÚ]Ú]\Ù\Ý[^BÛÛÝÛÛ\ÝH][KYÚ]Ý]ËYXÙJ
Z[Ý\HO
Ý\\Ù[YÙHZ[\Ù[YÙHÈÝ\Z[K][KYÚ]Ý]ÖÌJNÂXÛÛ[Y[YÛÛXÝH	ÑQTÉÎÂXÛÛ[Y[Y\Ù]HÛÛ\ÝÈÛÛ\ÝYÚ]][KÛÛYÚ]ÂØÛÜHHÛÛ\ÝÈX]Z[MX]X^
ÌX]Ý[

LHÛÛ\Ý\Ù[YÙJH
N
È
ÛÛ\Ý[^HMHÈ
JJJHNÂ][Û[HHÛÛ\ÝYÚ]ÉÜXÛÛ[Y[Y\Ù]H
ÛH	ØÛÛ\ÝË\Ù[YÙKÑ^Y
J_IH\K[^H	ØÛÛ\ÝË[^HHXÚÜÊXÂHY
ÛÛYËÝ]YÞHOOH	ÕSWÑQT×ÕÐUIÊHÂÛÛÝH[\ÝY\Õ\Ù]
X\Ù]XÚÜÖÚ][KÞ[XÛOËYÚ]È×K][K\ÝYÚ]
NÂXÛÛ[Y[YÛÛXÝH	ÑQTÉÎÈXÛÛ[Y[Y\Ù]H\Ù]YÚ]ÈØÛÜHHX]Ý[
Ú[ØX[]JNÂ][Û[HHÚ[ÚY[\Ù]ÉÜXÛÛ[Y[Y\Ù]H
	ÙYÚ]\]Y[ÞKÑ^Y
J_IHØÙ\Y\]Y[ÞK[^H	Ù[^_HXÚÜÊXÂÏ[ÛJËK	Ø[ÈY\ÉÊBOHH[ÙHY
ÛÛYËÝ]YÞHOOH	ÓPUÒT×ÔÓTTÕÐUIÊHÂ6öç7B÷GFW7BÒFVÒæFvE7FG2ç&VGV6RÖÂ7W"Óâ7W"çW&6VçFvRâÖçW&6VçFvRò7W"¢ÖÂFVÒæFvE7FG5³Ò°¢&V6öÖÖVæFVD6öçG&7BÒtÔD4U2s°¢&V6öÖÖVæFVEF&vWBÒ÷GFW7Bò÷GFW7BæFvB¢FVÒæ÷DFvC°¢66÷&RÒ÷GFW7BòÖFç&÷VæB÷GFW7BçW&6VçFvR¢BãR²#¢c°¢&FöæÆRÒ÷B6ÇW7FW"FvB2G·&V6öÖÖVæFVEF&vWGÒããW÷WB6æW"°¢Ð¢"" ¤#Ò"""ÒVÇ6Rb6öæfrç7G&FVwÓÓÒtÔD4U5õ4äU%õtdRr°¢6öç7B6rÒfæD&W7DWFôÖF6W5F&vWBFVÒç7Ö&öÂÂFVÒæF7ÆæÖRÂÖ&¶WEF6·5¶FVÒç7Ö&öÅÓòæFvG2ÇÂµÒÂFVÒæFvE7FG2ÂFVÒæÆ7DFvB°¢&V6öÖÖVæFVD6öçG&7BÒtÔD4U2s²&V6öÖÖVæFVEF&vWBÒ6rçF&vWDFvC²66÷&RÒÖFç&÷VæB6rç&ö&&ÆG66÷&R²&FöæÆRÒ6rç&FöæÆS°¢Ð¢"" §3ÖöæR2ÄÄ"Âv'VÆ²ÖF6W2r²rÇ2§&çBvgVÆÂ¤tâôÔD4U2v&ærÆVBrÿÿÿ