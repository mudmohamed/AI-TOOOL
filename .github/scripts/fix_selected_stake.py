from pathlib import Path

p = Path('src/services/derivWs.ts')
s = p.read_text()

start = s.index("    let barrier = params.barrier")
end = s.index("\n    const meta: TradeRequestMeta", start)
replacement = """    // Preserve exactly what the original strategy selected.\n    const barrier = params.barrier !== undefined && params.barrier !== '' ? String(params.barrier) : undefined;\n    const managedMatches = false;\n    const recoveryStep = 0;\n"""
s = s[:start] + replacement + s[end:]

old = "this.sendAccount({ buy: proposal.id, price: askPrice, req_id: buyReqId });"
new = """if (askPrice > meta.amount + 0.000001) {\n            this.notifyHandlers({ msg_type: 'trade_error', clientTradeId: meta.clientTradeId, stage: 'proposal', error: `Deriv proposal price ${askPrice.toFixed(2)} exceeds selected stake ${meta.amount.toFixed(2)}. Order blocked.` });\n            this.proposalMeta.delete(meta.clientTradeId);\n            return;\n          }\n          this.sendAccount({ buy: proposal.id, price: meta.amount, req_id: buyReqId });"""
if old not in s:
    raise SystemExit('buy block not found')
s = s.replace(old, new, 1)
p.write_text(s)

block = s[s.index('  public placeContract('):s.index('  public buyContract(', s.index('  public placeContract('))]
for token in ['Math.pow(state.multiplier', 'markovDigit(params.symbol', 'every third real tick', 'state.maxSteps']:
    if token in block:
        raise SystemExit(f'hidden override remains: {token}')
for token in ['const barrier = params.barrier', 'const managedMatches = false', 'price: meta.amount']:
    if token not in s:
        raise SystemExit(f'missing required guard: {token}')

print('selected stake and target preservation patch applied')
