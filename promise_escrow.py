# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from urllib.parse import urlparse
from genlayer import *

class PromiseEscrowContract(gl.Contract):
    promises_str: str
    evidence_str: str

    def __init__(self):
        # State storage
        self.promises_str = "{}"
        self.evidence_str = "{}"

    @gl.public.write.payable
    def create_promise(self, promise_id: str, statement: str, deadline_ts: int, trusted_domains: list, dev_address: str) -> None:
        """
        Creates a new promise. 
        CRITICAL SECURITY: The creator must define a strict list of trusted_domains (e.g. ['github.com', 'twitter.com']).
        This prevents attackers from defining their own trust model using fake domains.
        """
        promise_id = promise_id.strip().strip('"').strip("'")
        promises = json.loads(self.promises_str)
        if promise_id in promises:
            raise gl.vm.UserError("Promise ID already exists")
            
        if not trusted_domains:
            raise gl.vm.UserError("Must provide at least one trusted domain for source-authority")
            
        promises[promise_id] = {
            "creator": str(gl.message.sender_address),
            "statement": statement,
            "deadline": deadline_ts,
            "trusted_domains": trusted_domains,
            "bounty": gl.message.value, # Real Native Token Amount
            "status": "ACTIVE", # ACTIVE, FULFILLED, PARTIALLY_FULFILLED, BROKEN, UNVERIFIABLE, RECOVERED
            "dev_address": dev_address.strip().strip('"').strip("'"),
            "verdict_data": {}
        }
        self.promises_str = json.dumps(promises)
        
        evidence = json.loads(self.evidence_str)
        evidence[promise_id] = []
        self.evidence_str = json.dumps(evidence)

    @gl.public.write
    def add_evidence(self, promise_id: str, url: str, current_ts: int) -> None:
        """
        Adds evidence URLs. 
        CRITICAL SECURITY: Strictly parses the URL and enforces the Source-Authority policy.
        Enforces that only the assigned Developer can submit after claiming.
        Enforces Deadline.
        """
        promise_id = promise_id.strip().strip('"').strip("'")
        url = url.strip().strip('"').strip("'")
        promises = json.loads(self.promises_str)
        if promise_id not in promises:
            raise gl.vm.UserError("Promise not found")
            
        promise = promises[promise_id]
        if promise["status"] != "ACTIVE":
            raise gl.vm.UserError("Cannot add evidence, promise is not ACTIVE")
            
        if current_ts > promise["deadline"]:
            raise gl.vm.UserError("Deadline has passed, cannot submit evidence")
            
        sender = str(gl.message.sender_address)
        if promise["dev_address"] != sender:
            raise gl.vm.UserError("Only the assigned Developer can submit evidence for this Promise")
            
        # Parse URL and enforce strict domain whitelisting
        try:
            parsed_url = urlparse(url)
            hostname = parsed_url.hostname or ""
            
            # Check if hostname ends with any of the trusted domains
            is_trusted = False
            for domain in promise["trusted_domains"]:
                if hostname == domain or hostname.endswith("." + domain):
                    is_trusted = True
                    break
                    
            if not is_trusted:
                raise gl.vm.UserError(f"URL hostname '{hostname}' is not in trusted domains: {promise['trusted_domains']}")
                
        except Exception as e:
             raise gl.vm.UserError(f"Invalid URL format or untrusted domain: {str(e)}")
            
        evidence = json.loads(self.evidence_str)
        if url not in evidence[promise_id]:
            evidence[promise_id].append(url)
            
        self.evidence_str = json.dumps(evidence)
        self.promises_str = json.dumps(promises)

    @gl.public.write
    def recover_funds(self, promise_id: str, current_ts: int) -> None:
        """
        Allows the Creator to explicitly recover funds if the Deadline has passed 
        and no Developer has submitted any evidence. Prevents stranded funds.
        """
        promise_id = promise_id.strip().strip('"').strip("'")
        promises = json.loads(self.promises_str)
        if promise_id not in promises:
            raise gl.vm.UserError("Promise not found")
            
        promise = promises[promise_id]
        if promise["status"] != "ACTIVE":
            raise gl.vm.UserError("Promise must be ACTIVE to recover funds")
            
        if str(gl.message.sender_address) != promise["creator"]:
            raise gl.vm.UserError("Only Creator can recover stranded funds")
            
        if current_ts <= promise["deadline"]:
            raise gl.vm.UserError("Cannot recover funds before Deadline")
            
        evidence = json.loads(self.evidence_str).get(promise_id, [])
        if len(evidence) > 0:
            raise gl.vm.UserError("Evidence exists, you must use trigger_evaluation instead")
            
        promise["status"] = "RECOVERED"
        
        # Explicit Recovery Behavior
        if promise["bounty"] > 0:
            gl.transfer(promise["creator"], promise["bounty"])
            
        self.promises_str = json.dumps(promises)

    @gl.public.write
    def trigger_evaluation(self, promise_id: str, current_ts: int) -> None:
        """
        Evaluates the promise using AI Consensus.
        Enforces WHO can trigger (Creator or Developer) and WHEN.
        Executes active payout or refund based on the verdict.
        """
        promise_id = promise_id.strip().strip('"').strip("'")
        promises = json.loads(self.promises_str)
        if promise_id not in promises:
            raise gl.vm.UserError("Promise not found")
            
        promise = promises[promise_id]
        if promise["status"] != "ACTIVE":
            raise gl.vm.UserError("Promise must be ACTIVE to evaluate")
            
        sender = str(gl.message.sender_address)
        creator = promise["creator"]
        dev = promise["dev_address"]
        
        # Enforce Permissions & Timing
        if sender == creator:
            if current_ts <= promise["deadline"]:
                raise gl.vm.UserError("Creator cannot trigger evaluation before Deadline (must wait for Dev)")
        elif sender == dev:
            pass # Developer can trigger evaluation anytime if they finish early
        else:
            raise gl.vm.UserError("Only Creator or Developer can trigger evaluation")
            
        evidence = json.loads(self.evidence_str).get(promise_id, [])
        if not evidence:
            # Fallback if somehow triggered without evidence
            promise["status"] = "UNVERIFIABLE"
            if promise["bounty"] > 0:
                gl.transfer(creator, promise["bounty"])
            self.promises_str = json.dumps(promises)
            return

        def leader_fn() -> str:
            evidence_texts = []
            
            # Fail-Closed Web Acquisition
            for url in evidence[:3]: 
                try:
                    text = gl.nondet.web.render(url, mode="text")[:1500]
                    if not text.strip():
                        evidence_texts.append(f"Source URL ({url}):\nERROR_EMPTY_PAGE")
                    else:
                        evidence_texts.append(f"Source URL ({url}):\n{text}")
                except Exception:
                    # Gracefully handle unreachable links instead of crashing consensus
                    evidence_texts.append(f"Source URL ({url}):\nERROR_FETCHING_URL_OR_404")
                    
            combined_evidence = "\n\n---\n\n".join(evidence_texts)
            
            prompt = f"""
            You are a strict objective auditor. Evaluate if the following promise was fulfilled based ONLY on the evidence provided.
            
            PROMISE TO EVALUATE: {promise['statement']}
            
            EVIDENCE SCRAPED FROM WEB:
            {combined_evidence}
            
            INSTRUCTIONS:
            1. If evidence contains 'ERROR_FETCHING_URL_OR_404' and lacks sufficient other data, output UNVERIFIABLE.
            2. Extract obligations and compare them to reality. Check if events occurred.
            3. Respond EXACTLY with a JSON object in this format (no markdown, no quotes):
            {{"verdict": "FULFILLED" | "PARTIALLY_FULFILLED" | "BROKEN" | "UNVERIFIABLE", "confidence_score": <number 0-100>}}
            """
            
            try:
                ai_resp = gl.nondet.exec_prompt(prompt)
                
                # Robust Markdown stripping
                clean_resp = ai_resp.strip()
                if clean_resp.startswith("```json"):
                    clean_resp = clean_resp[7:]
                elif clean_resp.startswith("```"):
                    clean_resp = clean_resp[3:]
                if clean_resp.endswith("```"):
                    clean_resp = clean_resp[:-3]
                    
                parsed = json.loads(clean_resp.strip())
                verdict = parsed.get("verdict", "UNVERIFIABLE")
                score = int(parsed.get("confidence_score", 0))
                
                if verdict not in ["FULFILLED", "PARTIALLY_FULFILLED", "BROKEN"]:
                    verdict = "UNVERIFIABLE"
                    
                return json.dumps({"verdict": verdict, "confidence_score": score})
            except Exception:
                return json.dumps({"verdict": "UNVERIFIABLE", "confidence_score": 0})

        def validator_fn(leader_res) -> bool:
            try:
                leader_str = ""
                if type(leader_res) is str:
                    leader_str = leader_res
                elif hasattr(leader_res, "value"):
                    leader_str = leader_res.value
                elif hasattr(leader_res, "calldata"):
                    leader_str = leader_res.calldata
                else:
                    return False
                    
                l_data = json.loads(leader_str)
                v_data = json.loads(leader_fn())
                
                # 1. Strict Verdict Match
                if l_data.get("verdict") != v_data.get("verdict"):
                    return False
                    
                return True
            except Exception:
                return False

        final_res = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        
        try:
            final_str = final_res if type(final_res) is str else getattr(final_res, "value", "{}")
            final_data = json.loads(final_str)
            final_verdict = final_data.get("verdict", "UNVERIFIABLE")
        except:
            final_data = {}
            final_verdict = "UNVERIFIABLE"
            
        promise["status"] = final_verdict
        promise["verdict_data"] = final_data
        
        # ACTIVE PAYOUT & EXPLICIT REFUND BEHAVIOR
        if promise["bounty"] > 0:
            if final_verdict == "FULFILLED" and promise["dev_address"]:
                # Payout to Developer
                gl.transfer(promise["dev_address"], promise["bounty"])
            else:
                # Refund to Creator (for BROKEN, PARTIALLY_FULFILLED, UNVERIFIABLE)
                gl.transfer(creator, promise["bounty"])
            
        self.promises_str = json.dumps(promises)

    @gl.public.view
    def get_promise(self, promise_id: str) -> str:
        promise_id = promise_id.strip().strip('"').strip("'")
        promises = json.loads(self.promises_str)
        evidence = json.loads(self.evidence_str)
        if promise_id in promises:
            data = promises[promise_id]
            data["evidence"] = evidence.get(promise_id, [])
            return json.dumps(data)
        return "{}"
