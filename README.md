# Institutional Proof of Promise

An escrow Intelligent Contract on [GenLayer](https://genlayer.com). A creator funds a promise
and names a developer. The developer submits evidence. After the deadline, a validator set of
independent LLMs reads the evidence, returns a verdict, and the bounty is settled accordingly.

**Deployed (Studionet):** [`0xe2939Af48086Ce08dba291113AcC172D6119f552`](https://explorer-studio.genlayer.com/address/0xe2939Af48086Ce08dba291113AcC172D6119f552)

---

## Responding to the review

The review asked for four things. Each one is verified on-chain, not just implemented.

| Requirement | Status | Evidence |
|---|---|---|
| Active payout for fulfilled promises | ✅ | `withdraw` moved 100 GEN to the developer wallet |
| Explicit refund/recovery for every other terminal outcome | ✅ | Refund path settled and returned the bounty to the creator |
| Enforce who may submit evidence and trigger evaluation | ✅ | Both reverted for unauthorised callers |
| Deadline enforced, funds never stranded or settled early | ✅ | Early evaluation reverted; `reclaim_expired` is permissionless |

### Payout — 100 GEN actually moved

```
0x0b482288...ca597bd3   Send   FINALIZED   OUT
  from 0xe2939Af4...19f552 (contract)  ->  0xFC7b6944...49c81B (developer)
```

Developer wallet: **1100 GEN → 1200 GEN**. Contract balance: **100 GEN → 0 GEN**.

Verdict that triggered it, agreed by four validators running different models
(claude-sonnet-4-6, gemini, gemma, gpt-5-4):

```json
{"verdict": "FULFILLED", "confidence_score": 99,
 "reason": "The GitHub page for genlayerlabs/genlayer-project-boilerplate is publicly
            accessible, showing a public repository with code, issues, PRs, and a README.
            The promise is clearly fulfilled."}
```

### Every terminal outcome distributes the full bounty

| Outcome | Developer | Creator |
|---|---|---|
| `FULFILLED` | 100% | — |
| `PARTIALLY_FULFILLED` | 50% | 50% |
| `BROKEN` | — | 100% |
| `UNVERIFIABLE` (incl. no evidence) | — | 100% |
| `reclaim_expired` — nobody adjudicated in time | — | 100% |
| `cancel_promise` — creator withdrew before deadline, zero evidence | — | 100% |

`_split_payout` guarantees `dev_share + creator_share == bounty` for every verdict, including
odd amounts. Nothing is ever left behind.

### Authorisation and deadlines

- `add_evidence` — assigned developer only, and only while the evidence window is open
- `trigger_evaluation` — creator or developer only, and only after the window closes
- `cancel_promise` — creator only, before the deadline, and only if no evidence exists
- `reclaim_expired` — permissionless, but funds always go to the creator

The deadline is read from the transaction context, **not** from a caller-supplied timestamp.
The previous version accepted `current_ts` as a parameter, which meant anyone could pass
`9999999999` and settle immediately. That parameter is gone.

---

## Timeline of a promise

```
create ───── deadline ───── evidence_deadline ───── reclaim_at
   │             │                  │                    │
   │  developer  │  grace period    │  creator or dev    │  anyone can
   │  submits    │  for late        │  triggers          │  refund the
   │  evidence   │  evidence        │  evaluation        │  creator
```

## Public interface

| Method | Caller | Purpose |
|---|---|---|
| `create_promise` | creator | Fund a promise and assign the developer (payable) |
| `add_evidence` | developer | Submit an evidence URL from a whitelisted domain |
| `trigger_evaluation` | creator or developer | Run the LLM adjudication and settle |
| `withdraw` | creator or developer | Pull your settled share |
| `reclaim_expired` | anyone | Return the bounty to the creator after expiry |
| `cancel_promise` | creator | Withdraw before the deadline if no evidence exists |
| `get_promise` / `get_all_promises` | anyone | Read state |

`trusted_domains_json` is a JSON string, e.g. `["github.com"]` — see the notes below.

---

## Four things we learned about GenVM

These cost real debugging time and are not obvious from the docs.

### 1. Calldata parameters accept only `str`, `int`, `bool`

```python
# Breaks schema loading — Studio shows "Could not load contract schema"
def create_promise(self, trusted_domains: list, ...) -> None:

# Works
def create_promise(self, trusted_domains_json: str, ...) -> None:
```

Pass arrays as a JSON string and `json.loads` them inside the method. `list[str]` fails too.

### 2. Paying an EOA is an *external* message

```python
# Wrong — this is the IC-to-IC path. Against an EOA, GenVM tries to execute code at
# the address, the sub-transaction fails as a "(constructor)" call with ERROR, and
# the value stays in the contract.
gl.get_contract_at(addr).emit_transfer(value=amount)

# Right
@gl.evm.contract_interface
class _Payee:
    class View: pass
    class Write: pass

_Payee(Address(addr)).emit_transfer(value=u256(amount))
```

EOAs live on the chain layer, so this goes through the contract's ghost contract — the same
mechanism used for calling EVM contracts.

### 3. A failed sub-transaction does not revert the parent — so push payments are unsafe

The first version transferred inside `_finalise`: zero the ledger, then send. When the transfer
failed, the parent transaction still reported SUCCESS. The result was a promise marked
`SETTLED` with `payout_dev` recorded and `bounty_locked = 0`, while the money sat in the
contract with no way to claim it — exactly the stranded funds the review asked us to prevent.

Settlement now records **entitlements** (`owed_dev`, `owed_creator`) and never moves value.
Beneficiaries call `withdraw`, which writes the ledger before transferring. If the transfer
fails, the whole call reverts and the entitlement survives, so it can simply be retried.

This is why the contract state alone is not proof of payment. Always check the recipient's
balance.

### 4. Validators must not re-run the leader's non-deterministic work

```python
# Wrong — every validator issues its own web request and LLM call, then two independent
# LLM runs are required to produce matching output. Result: SENDING_REQUEST errors and
# "majority disagreement, rotating leader" until the transaction stalls.
def validator_fn(leader_res) -> bool:
    return json.loads(leader_res) == json.loads(leader_fn())

# Right — the leader produces the verdict, validators judge whether it is acceptable
gl.eq_principle.prompt_comparative(leader_fn, "Both answers must state the same 'verdict'...")
```

---

## Prompt injection

Evidence is fetched from the open web, so page content is untrusted. The auditor prompt fences
both the promise statement and the evidence in `<UNTRUSTED>` blocks, and the fence markers are
stripped from the input first so injected text cannot close the fence early. The model is told
explicitly that anything inside those blocks is data, never instructions.

Evidence URLs are additionally constrained: `https` only, no embedded credentials, and the
hostname must match a domain the creator whitelisted at creation time.

## Development

```bash
genvm-lint check contracts/promise_escrow.py
pytest tests/direct/ -v
```

`debug_api` is a diagnostic view that reports the available SDK surface. Remove it before a
production deployment.

## Licence

MIT
