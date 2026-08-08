import React, { useState, useEffect } from 'react';
import { getClient, CONTRACT_ADDRESS } from './lib/genlayer';
import { parseEther, formatEther } from 'viem';
import { 
  ShieldCheck, 
  Search, 
  Plus, 
  ExternalLink,
  Cpu,
  Loader2,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react';

const getSavedDemoIds = (): string[] => {
  const saved = localStorage.getItem('demo_ids');
  return saved ? JSON.parse(saved) : [];
};
let DEMO_PROMISE_IDS: string[] = getSavedDemoIds();

export default function App() {
  const [promises, setPromises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [searchId, setSearchId] = useState('');
  
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  // Create Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newStatement, setNewStatement] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newDomains, setNewDomains] = useState('');
  const [newDevAddress, setNewDevAddress] = useState('');
  const [bountyAmount, setBountyAmount] = useState('');
  const [evidenceWindow, setEvidenceWindow] = useState('0');
  const [reclaimGrace, setReclaimGrace] = useState('86400');

  // Evidence Modal
  const [showEvidence, setShowEvidence] = useState(false);
  const [activePromiseId, setActivePromiseId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  useEffect(() => {
    fetchAllDemoPromises();
  }, []);

  const fetchAllDemoPromises = async () => {
    setLoading(true);
    setLoadingText('Loading Promises...');
    try {
      const results = await Promise.all(
        DEMO_PROMISE_IDS.map(async (id) => {
          try {
            // @ts-ignore
            const res = await getClient().readContract({
              address: CONTRACT_ADDRESS,
              functionName: 'get_promise',
              args: [id]
            });
            if (res && res !== '{}') {
              return { id, ...JSON.parse(res as string) };
            }
            return null;
          } catch (e) {
            console.error(e);
            return null;
          }
        })
      );
      setPromises(results.filter(p => p !== null));
    } catch (e) {
      console.error("Failed to fetch", e);
    }
    setLoading(false);
  };

  const waitForCondition = async (checkCondition: () => Promise<boolean>, loadingMsg: string) => {
    setLoadingText(loadingMsg);
    let attempts = 0;
    const maxAttempts = 45;
    const poll = async () => {
      attempts++;
      try {
        const isDone = await checkCondition();
        if (isDone) { await fetchAllDemoPromises(); return; }
      } catch (e) {}
      if (attempts >= maxAttempts) { await fetchAllDemoPromises(); return; }
      setTimeout(poll, 4000);
    };
    setTimeout(poll, 4000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    setLoading(true);
    setLoadingText('Searching...');
    try {
      // @ts-ignore
      const res = await getClient().readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_promise',
        args: [searchId]
      });
      if (res && res !== '{}') {
        const parsed = { id: searchId, ...JSON.parse(res as string) };
        if (!promises.find(p => p.id === searchId)) {
          setPromises(prev => [parsed, ...prev]);
          if (!DEMO_PROMISE_IDS.includes(searchId)) {
            DEMO_PROMISE_IDS.push(searchId);
            localStorage.setItem('demo_ids', JSON.stringify(DEMO_PROMISE_IDS));
          }
        }
      } else {
        alert("Promise not found!");
      }
    } catch (e) {
      console.error(e);
      alert("Error fetching promise");
    }
    setLoading(false);
  };

  const handleCreatePromise = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      // v9: trusted_domains must be a JSON string, not an array
      const domainsArray = newDomains.split(',').map(d => d.trim());
      const domainsJson = JSON.stringify(domainsArray);

      setShowCreate(false);
      setLoading(true);
      setLoadingText('Please confirm the transaction in your wallet...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'create_promise',
        // v9 signature: (promise_id, statement, deadline_ts, trusted_domains_json, dev_address, evidence_window_s, reclaim_grace_s)
        args: [newId, newStatement, parseInt(newDeadline), domainsJson, newDevAddress, parseInt(evidenceWindow), parseInt(reclaimGrace)],
        value: parseEther(bountyAmount)
      });

      if (!DEMO_PROMISE_IDS.includes(newId)) {
        DEMO_PROMISE_IDS.push(newId);
        localStorage.setItem('demo_ids', JSON.stringify(DEMO_PROMISE_IDS));
      }

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [newId]
        });
        return !!res && res !== '{}';
      }, 'Transaction sent! Waiting for GenLayer confirmation...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      setShowEvidence(false);
      setLoading(true);
      setLoadingText('Submitting evidence...');

      const currentPromise = promises.find(p => p.id === activePromiseId);
      const oldLength = currentPromise?.evidence?.length || 0;

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'add_evidence',
        // v9: no current_ts — deadline is read from the transaction context
        args: [activePromiseId, evidenceUrl]
      });

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [activePromiseId]
        });
        if (!res || res === '{}') return false;
        const p = JSON.parse(res as string);
        return p.evidence && p.evidence.length > oldLength;
      }, 'Submitting evidence... Waiting for confirmation...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleTriggerEval = async (id: string) => {
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      setLoading(true);
      setLoadingText('Please confirm the evaluation request in your wallet...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'trigger_evaluation',
        // v9: no current_ts — time comes from the transaction context
        args: [id]
      });

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [id]
        });
        if (!res || res === '{}') return false;
        const p = JSON.parse(res as string);
        return p.status !== 'ACTIVE';
      }, 'AI is evaluating... Waiting for GenVM Semantic Consensus...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleReclaimExpired = async (id: string) => {
    if (!window.confirm("Reclaim expired funds? This returns the bounty to the creator.")) return;
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      setLoading(true);
      setLoadingText('Reclaiming funds...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'reclaim_expired',
        // v9: no current_ts
        args: [id]
      });

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [id]
        });
        if (!res || res === '{}') return false;
        const p = JSON.parse(res as string);
        return p.status === 'REFUNDED_EXPIRED';
      }, 'Reclaiming... Waiting for confirmation...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleCancelPromise = async (id: string) => {
    if (!window.confirm("Cancel this promise and reclaim your bounty?")) return;
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      setLoading(true);
      setLoadingText('Cancelling promise...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'cancel_promise',
        args: [id]
      });

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [id]
        });
        if (!res || res === '{}') return false;
        const p = JSON.parse(res as string);
        return p.status === 'CANCELLED';
      }, 'Cancelling... Waiting for confirmation...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  // v9: pull-payment model — after settlement, each party calls withdraw() to receive funds
  const handleWithdraw = async (id: string) => {
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");

      setLoading(true);
      setLoadingText('Withdrawing funds...');

      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'withdraw',
        args: [id]
      });

      waitForCondition(async () => {
        // @ts-ignore
        const res = await getClient().readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_promise',
          args: [id]
        });
        if (!res || res === '{}') return false;
        const p = JSON.parse(res as string);
        // settled when whoever triggered the withdraw has nothing left owed
        const addr = walletAddress.toLowerCase();
        if (addr === p.dev?.toLowerCase()) return parseInt(p.owed_dev || '0') === 0;
        if (addr === p.creator?.toLowerCase()) return parseInt(p.owed_creator || '0') === 0;
        return false;
      }, 'Withdrawing... Waiting for confirmation...');

    } catch (e: any) {
      alert("Error: " + e.message);
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xf22f' }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xf22f',
                chainName: 'Genlayer Studio Network',
                rpcUrls: ['https://studio.genlayer.com/api'],
                nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
                blockExplorerUrls: ['https://explorer-studio.genlayer.com'],
              }],
            });
          }
        }
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
        }
      } else {
        alert("No Web3 wallet detected. Please install MetaMask.");
      }
    } catch (e: any) {
      alert("Failed to connect wallet: " + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, JSX.Element> = {
      ACTIVE:           <span className="badge badge-active">ACTIVE</span>,
      SETTLED:          <span className="badge badge-fulfilled"><CheckCircle2 size={12} className="mr-1"/> SETTLED</span>,
      FULFILLED:        <span className="badge badge-fulfilled"><CheckCircle2 size={12} className="mr-1"/> FULFILLED</span>,
      CANCELLED:        <span className="badge badge-unverifiable"><XCircle size={12} className="mr-1"/> CANCELLED</span>,
      REFUNDED_EXPIRED: <span className="badge badge-unverifiable"><XCircle size={12} className="mr-1"/> REFUNDED</span>,
      UNVERIFIABLE:     <span className="badge badge-unverifiable"><XCircle size={12} className="mr-1"/> UNVERIFIABLE</span>,
    };
    return map[status] ?? <span className="badge badge-unverifiable">{status}</span>;
  };

  // How much the connected wallet can withdraw from a settled promise
  const myOwed = (p: any): bigint => {
    if (!walletAddress) return 0n;
    const addr = walletAddress.toLowerCase();
    if (addr === p.dev?.toLowerCase()) return BigInt(p.owed_dev || 0);
    if (addr === p.creator?.toLowerCase()) return BigInt(p.owed_creator || 0);
    return 0n;
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear local promise history?")) {
      DEMO_PROMISE_IDS = [];
      localStorage.setItem('demo_ids', JSON.stringify(DEMO_PROMISE_IDS));
      setPromises([]);
      fetchAllDemoPromises();
    }
  };

  return (
    <div>
      <nav className="navbar flex-between">
        <div className="brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={fetchAllDemoPromises}>
          <ShieldCheck size={32} color="var(--accent-color)" />
          <h2>Promise Protocol</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={handleClearHistory} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>
            Clear History
          </button>
          {walletConnected ? (
            <button className="btn-primary" onClick={() => { setWalletAddress(''); setWalletConnected(false); }} style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {walletAddress.substring(0,6)}...{walletAddress.substring(walletAddress.length-4)} <XCircle size={14}/>
            </button>
          ) : (
            <button className="btn-primary" onClick={handleConnectWallet}>Connect Wallet</button>
          )}
        </div>
      </nav>

      <main className="container">
        <div className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>Decentralized Escrow & Grants</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Powered by GenVM Semantic Consensus</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} style={{ display: 'inline', marginRight: '8px' }}/> Create Promise
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
          <input className="input-field" placeholder="Search Promise ID..." value={searchId} onChange={e => setSearchId(e.target.value)} style={{ width: '300px' }}/>
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18}/> Lookup
          </button>
        </form>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', gap: '1rem' }}>
            <Loader2 size={48} color="var(--accent-color)" style={{ animation: 'spin 1.5s linear infinite' }}/>
            <p style={{ color: 'var(--accent-color)', fontSize: '1.2rem', fontWeight: 500 }}>{loadingText}</p>
          </div>
        ) : (
          <div className="grid">
            {promises.map((p, idx) => (
              <div key={idx} className="glass-panel">
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ color: 'var(--accent-color)' }}>#{p.id}</h3>
                  {getStatusBadge(p.status)}
                </div>

                <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>"{p.statement}"</p>

                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <p><strong>Bounty:</strong> {p.bounty_initial ? formatEther(BigInt(p.bounty_initial)) : '0'} GEN</p>
                  <p><strong>Locked:</strong> {p.bounty_locked ? formatEther(BigInt(p.bounty_locked)) : '0'} GEN</p>
                  <p><strong>Trusted Sources:</strong> {p.trusted_domains?.join(', ')}</p>
                  <p><strong>Deadline:</strong> {new Date(p.deadline * 1000).toLocaleString()}</p>
                  {p.creator && <p><strong>Creator:</strong> <span style={{ color: 'var(--accent-color)' }}>{p.creator.substring(0,6)}...{p.creator.substring(p.creator.length-4)}</span></p>}
                  {p.dev && <p><strong>Developer:</strong> <span style={{ color: 'var(--success-color)' }}>{p.dev.substring(0,6)}...{p.dev.substring(p.dev.length-4)}</span></p>}
                  {p.verdict && <p><strong>Verdict:</strong> {p.verdict} ({p.verdict_data?.confidence_score ?? 0}%)</p>}
                  {p.verdict_data?.reason && <p style={{ fontStyle: 'italic', marginTop: '4px' }}>"{p.verdict_data.reason}"</p>}
                </div>

                {p.evidence && p.evidence.length > 0 && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--surface-color)', borderRadius: '4px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Evidence:</p>
                    {p.evidence.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', marginBottom: '4px' }}>
                        {url} <ExternalLink size={12}/>
                      </a>
                    ))}
                  </div>
                )}

                {/* ACTIVE actions */}
                {p.status === 'ACTIVE' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} onClick={() => { setActivePromiseId(p.id); setShowEvidence(true); }}>
                      Add Evidence
                    </button>
                    {p.evidence?.length > 0 && (
                      <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: 'rgba(102,252,241,0.1)' }} onClick={() => handleTriggerEval(p.id)}>
                        <Cpu size={16} style={{ display: 'inline', marginRight: '5px' }}/> Evaluate
                      </button>
                    )}
                    {/* Cancel — creator only, no evidence yet */}
                    {walletConnected && p.creator?.toLowerCase() === walletAddress.toLowerCase() && (!p.evidence || p.evidence.length === 0) && (
                      <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }} onClick={() => handleCancelPromise(p.id)}>
                        Cancel
                      </button>
                    )}
                    {/* Reclaim — permissionless, after reclaim_at */}
                    <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }} onClick={() => handleReclaimExpired(p.id)}>
                      Reclaim
                    </button>
                  </div>
                )}

                {/* SETTLED — withdraw if owed */}
                {p.status === 'SETTLED' && walletConnected && myOwed(p) > 0n && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <button className="btn-primary" style={{ width: '100%', padding: '10px', fontSize: '0.9rem', background: 'rgba(16,185,129,0.1)', borderColor: 'var(--success-color)', color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => handleWithdraw(p.id)}>
                      <Download size={16}/> Withdraw {formatEther(myOwed(p))} GEN
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem' }}>
          <div className="glass-panel" style={{ width: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}><ShieldCheck size={20} style={{ display: 'inline', marginRight: '8px' }}/>Create Promise</h2>
              <button type="button" onClick={() => {
                const hex = Math.floor(Math.random() * 16777215).toString(16).padStart(6,'0').toUpperCase();
                setNewId(`PROMISE_${hex}`);
                setNewStatement('The genlayer-project-boilerplate repository is published on GitHub');
                setNewDeadline(String(Math.floor(Date.now()/1000) + 600));
                setNewDomains('github.com');
                setNewDevAddress('');
                setBountyAmount('1');
                setEvidenceWindow('0');
                setReclaimGrace('86400');
              }} style={{ background: 'var(--accent-color)', color: '#000', padding: '5px 10px', borderRadius: '5px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                ⚡ Auto-fill
              </button>
            </div>
            <form onSubmit={handleCreatePromise}>
              <div className="input-group"><label>Promise ID</label><input className="input-field" required value={newId} onChange={e => setNewId(e.target.value)}/></div>
              <div className="input-group"><label>Goal Statement</label><input className="input-field" required value={newStatement} onChange={e => setNewStatement(e.target.value)}/></div>
              <div className="input-group"><label>Deadline (Unix Timestamp)</label><input className="input-field" required type="number" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}/></div>
              <div className="input-group"><label>Bounty Amount (GEN)</label><input className="input-field" required type="number" step="0.01" value={bountyAmount} onChange={e => setBountyAmount(e.target.value)}/></div>
              <div className="input-group">
                <label>Trusted Domains (comma separated)</label>
                <input className="input-field" required placeholder="github.com, example.com" value={newDomains} onChange={e => setNewDomains(e.target.value)}/>
                <small style={{ color: 'var(--text-secondary)' }}>Will be sent as JSON — e.g. ["github.com"]</small>
              </div>
              <div className="input-group"><label>Developer Wallet Address</label><input className="input-field" required placeholder="0x..." value={newDevAddress} onChange={e => setNewDevAddress(e.target.value)}/></div>
              <div className="input-group">
                <label>Evidence Window (seconds after deadline)</label>
                <input className="input-field" type="number" value={evidenceWindow} onChange={e => setEvidenceWindow(e.target.value)}/>
                <small style={{ color: 'var(--text-secondary)' }}>0 = evidence must be submitted before deadline</small>
              </div>
              <div className="input-group">
                <label>Reclaim Grace Period (seconds)</label>
                <input className="input-field" type="number" value={reclaimGrace} onChange={e => setReclaimGrace(e.target.value)}/>
                <small style={{ color: 'var(--text-secondary)' }}>After this, anyone can reclaim funds for the creator (min 60)</small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Submit</button>
                <button type="button" className="btn-primary" style={{ flex: 1, borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }} onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Modal */}
      {showEvidence && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '400px' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Submit Evidence</h2>
              <button type="button" onClick={() => setEvidenceUrl('https://github.com/genlayerlabs/genlayer-project-boilerplate')} style={{ background: 'var(--accent-color)', color: '#000', padding: '5px 10px', borderRadius: '5px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                ⚡ Auto-fill
              </button>
            </div>
            <form onSubmit={handleAddEvidence}>
              <div className="input-group"><label>Evidence URL (must match trusted domain)</label><input className="input-field" required value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)}/></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Submit</button>
                <button type="button" className="btn-primary" style={{ flex: 1, borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }} onClick={() => setShowEvidence(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
