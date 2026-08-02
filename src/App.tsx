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
  XCircle
} from 'lucide-react';

// Persist created IDs in LocalStorage for the demo
const getSavedDemoIds = (): string[] => {
  const saved = localStorage.getItem('demo_ids');
  return saved ? JSON.parse(saved) : ['BTC_001'];
};
let DEMO_PROMISE_IDS: string[] = getSavedDemoIds();

export default function App() {
  const [promises, setPromises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  
  // Wallet State
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  // Create Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newStatement, setNewStatement] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newDomains, setNewDomains] = useState('');
  const [bountyAmount, setBountyAmount] = useState('0');

  // Evidence Modal State
  const [showEvidence, setShowEvidence] = useState(false);
  const [activePromiseId, setActivePromiseId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  useEffect(() => {
    fetchAllDemoPromises();
  }, []);

  const fetchAllDemoPromises = async () => {
    setLoading(true);
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    setLoading(true);
    try {
      // @ts-ignore
      const res = await getClient().readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_promise',
        args: [searchId]
      });
      if (res && res !== '{}') {
        const parsed = { id: searchId, ...JSON.parse(res as string) };
        // avoid duplicates
        if (!promises.find(p => p.id === searchId)) {
          setPromises(prev => [parsed, ...prev]);
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
      const domainsArray = newDomains.split(',').map(d => d.trim());
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'create_promise',
        args: [newId, newStatement, parseInt(newDeadline), domainsArray],
        value: parseEther(bountyAmount)
      });
      alert("Promise creation transaction sent! Please wait a few seconds for the network to process it.");
      setShowCreate(false);
      if (!DEMO_PROMISE_IDS.includes(newId)) {
        DEMO_PROMISE_IDS.push(newId);
        localStorage.setItem('demo_ids', JSON.stringify(DEMO_PROMISE_IDS));
      }
      
      // Add a small delay for the blockchain to mine the transaction
      setLoading(true);
      setTimeout(() => {
        fetchAllDemoPromises();
      }, 5000);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'add_evidence',
        args: [activePromiseId, evidenceUrl]
      });
      alert("Evidence submitted!");
      setShowEvidence(false);
      fetchAllDemoPromises();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleTriggerEval = async (id: string) => {
    try {
      if (!walletConnected) throw new Error("Please connect your wallet first.");
      // @ts-ignore
      await getClient(walletAddress).writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'trigger_evaluation',
        args: [id]
      });
      alert("AI Evaluation triggered! It may take a few seconds to reach consensus.");
      // Poll for update
      setTimeout(() => fetchAllDemoPromises(), 10000);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        
        // Force switch to Genlayer Studio Network
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xf22f' }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0xf22f',
                  chainName: 'Genlayer Studio Network',
                  rpcUrls: ['https://studio.genlayer.com/api'],
                  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
                  blockExplorerUrls: ['https://genlayer-explorer.vercel.app'],
                },
              ],
            });
          }
        }

        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
        }
      } else {
        alert("No Web3 wallet detected! Please install MetaMask or GenLayer Wallet to connect to the real network.");
      }
    } catch (e: any) {
      console.error("Wallet connection failed", e);
      alert("Failed to connect wallet: " + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="badge badge-active">ACTIVE</span>;
      case 'FULFILLED': return <span className="badge badge-fulfilled"><CheckCircle2 size={12} className="mr-1"/> FULFILLED</span>;
      case 'UNVERIFIABLE': return <span className="badge badge-unverifiable"><XCircle size={12} className="mr-1"/> UNVERIFIABLE</span>;
      default: return <span className="badge badge-unverifiable">{status}</span>;
    }
  };

  const fillDemoScenario = () => {
    setNewId(`HACKATHON_001`);
    setNewStatement("Build a decentralized escrow UI in React and deploy it");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setNewDeadline(Math.floor(futureDate.getTime() / 1000).toString());
    setNewDomains("github.com, vercel.app");
    setBountyAmount("1");
  };

  return (
    <div>
      <nav className="navbar flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={32} color="var(--accent-color)" />
          <h2>Promise Protocol</h2>
        </div>
        <button 
          className="btn-primary" 
          onClick={handleConnectWallet}
          style={walletConnected ? { borderColor: 'var(--success-color)', color: 'var(--success-color)', textShadow: 'none', boxShadow: 'none' } : {}}
        >
          {walletConnected ? `Connected: ${walletAddress.substring(0,6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'Connect Wallet'}
        </button>
      </nav>

      <main className="container">
        <div className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.5rem' }}>Decentralized Escrow & Grants</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Powered by GenVM Semantic Consensus</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} style={{ display: 'inline', marginRight: '8px' }}/> 
            Create Promise
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
          <input 
            className="input-field" 
            placeholder="Search Promise ID..." 
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            style={{ width: '300px' }}
          />
          <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} /> Lookup
          </button>
        </form>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-pulse" size={48} color="var(--accent-color)" />
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
                  <p><strong>Bounty:</strong> {p.bounty ? formatEther(BigInt(p.bounty)) : '0'} GEN</p>
                  <p><strong>Trusted Sources:</strong> {p.trusted_domains?.join(', ')}</p>
                  <p><strong>Deadline:</strong> {new Date(p.deadline * 1000).toLocaleString()}</p>
                </div>

                {p.evidence && p.evidence.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Evidence Submitted:</p>
                    <a href={p.evidence[0]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                      {p.evidence[0]} <ExternalLink size={12} style={{ display: 'inline' }}/>
                    </a>
                  </div>
                )}

                {p.status === 'ACTIVE' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                    <button 
                      className="btn-primary" 
                      style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }}
                      onClick={() => { setActivePromiseId(p.id); setShowEvidence(true); }}
                    >
                      Add Evidence
                    </button>
                    {p.evidence?.length > 0 && (
                      <button 
                        className="btn-primary animate-pulse" 
                        style={{ flex: 1, padding: '8px', fontSize: '0.9rem', background: 'rgba(102, 252, 241, 0.1)' }}
                        onClick={() => handleTriggerEval(p.id)}
                      >
                        <Cpu size={16} style={{ display: 'inline', marginRight: '5px' }}/>
                        Evaluate
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Create Promise</h2>
              <button type="button" onClick={fillDemoScenario} style={{ background: 'var(--accent-color)', color: '#000', padding: '5px 10px', borderRadius: '5px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Auto-fill</button>
            </div>
            <form onSubmit={handleCreatePromise}>
              <div className="input-group">
                <label>Promise ID</label>
                <input className="input-field" required value={newId} onChange={e => setNewId(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Goal Statement</label>
                <input className="input-field" required value={newStatement} onChange={e => setNewStatement(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Deadline (Unix Timestamp)</label>
                <input className="input-field" required type="number" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Bounty Amount (GEN)</label>
                <input className="input-field" required type="number" step="0.01" value={bountyAmount} onChange={e => setBountyAmount(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Trusted Domains (comma separated)</label>
                <input className="input-field" required placeholder="github.com, example.com" value={newDomains} onChange={e => setNewDomains(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Submit</button>
                <button type="button" className="btn-primary" style={{ flex: 1, borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }} onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEvidence && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Submit Evidence</h2>
            <form onSubmit={handleAddEvidence}>
              <div className="input-group">
                <label>Evidence URL</label>
                <input className="input-field" required value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} />
              </div>
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
