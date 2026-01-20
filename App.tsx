import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Users, Play, RotateCcw, Save, Upload, FileJson, 
  ChevronLeft, ChevronRight, BarChart2, Video, 
  Eraser, Download, PieChart, Activity, AlertTriangle, Plus, Trash2, FileText, Zap, Dna, ClipboardList, Printer, Pencil, X, FolderHeart, RefreshCw, CheckCircle, Lock, ScrollText, LogOut
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import CourtMap from './components/CourtMap';
import { 
  Team, Player, MatchMetadata, Lineup, TagEvent, 
  Zone, SkillType, ResultType, PlayerRole, TeamSide, 
  Coordinate, GradeType, SkillSubType 
} from './types';

import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './firebase';

// --- Constants ---

const POSITIONS: Zone[] = [4, 3, 2, 5, 6, 1]; 
const AWAY_POSITIONS: Zone[] = [5, 6, 1, 4, 3, 2]; 

const ROLES: { id: PlayerRole; label: string }[] = [
  { id: 'OH', label: '大砲 (OH)' },
  { id: 'MB', label: '快攻 (MB)' },
  { id: 'OP', label: '舉對 (OP)' },
  { id: 'S', label: '舉球 (S)' },
  { id: 'L', label: '自由 (L)' },
  { id: 'DS', label: '防守 (DS)' },
  { id: '?', label: '未定' },
];

const getRoleName = (roleId?: PlayerRole) => {
    if (!roleId || roleId === '?') return '未定';
    return ROLES.find(r => r.id === roleId)?.label || roleId;
};

const SKILLS: { id: SkillType; label: string; color: string }[] = [
  { id: 'Serve', label: '發球', color: 'bg-blue-600' },
  { id: 'Receive', label: '接發', color: 'bg-amber-600' },
  { id: 'Set', label: '舉球', color: 'bg-yellow-500' },
  { id: 'Attack', label: '攻擊', color: 'bg-red-600' },
  { id: 'Block', label: '攔網', color: 'bg-purple-600' },
  { id: 'Dig', label: '防守', color: 'bg-emerald-600' },
  { id: 'Freeball', label: '修正', color: 'bg-cyan-600' },
  { id: 'Fault', label: '失誤', color: 'bg-slate-600' },
  { id: 'Substitution', label: '換人', color: 'bg-slate-500' },
];

const GRADES: { id: GradeType; label: string; color: string }[] = [
  { id: '#', label: '完美', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: '+', label: '到位', color: 'bg-green-100 text-green-800 border-green-300' },
  { id: '!', label: '普通', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { id: '-', label: '處理', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { id: '=', label: '失誤', color: 'bg-red-100 text-red-800 border-red-300' },
];

const ATTACK_SUBTYPES: {id: SkillSubType, label: string, color: string}[] = [
    {id: 'Open', label: '長攻', color: 'bg-red-500'}, 
    {id: 'QuickA', label: 'A快 (前快)', color: 'bg-orange-500'}, 
    {id: 'QuickB', label: 'B快 (前長)', color: 'bg-orange-500'},
    {id: 'QuickC', label: 'C快 (背快)', color: 'bg-orange-500'}, 
    {id: 'BackRow', label: '後排', color: 'bg-rose-500'}, 
    {id: 'Tip', label: '吊球', color: 'bg-pink-500'},
    {id: 'Tool', label: '打手', color: 'bg-red-400'}
];

const SERVE_SUBTYPES: {id: SkillSubType, label: string, color: string}[] = [
    {id: 'Float', label: '飄球', color: 'bg-sky-500'}, 
    {id: 'Spin', label: '強發', color: 'bg-blue-700'}
];

const FAULT_SUBTYPES: {id: SkillSubType, label: string, color: string}[] = [
    {id: 'NetTouch', label: '觸網', color: 'bg-slate-500'}, 
    {id: 'DoubleHit', label: '連擊', color: 'bg-slate-500'}, 
    {id: 'Violation', label: '違例', color: 'bg-slate-500'},
    {id: 'Out', label: '出界', color: 'bg-slate-500'},
    {id: 'Carry', label: '持球', color: 'bg-slate-500'},
    {id: 'Rotation', label: '輪轉', color: 'bg-slate-500'}
];

const SET_SUBTYPES: {id: SkillSubType, label: string, color: string}[] = [
    {id: 'SetA', label: 'A快 (前快)', color: 'bg-yellow-600'},
    {id: 'SetB', label: 'B快 (前長)', color: 'bg-yellow-600'},
    {id: 'SetC', label: 'C快 (背快)', color: 'bg-yellow-600'},
    {id: 'SetOpen', label: '長攻', color: 'bg-yellow-500'},
    {id: 'SetSlide', label: '背飛', color: 'bg-amber-500'}
];

const TAGS: { id: string; label: string; color: string }[] = [
    { id: 'Highlight', label: '精彩 ⭐', color: 'bg-yellow-400 text-black' },
    { id: 'Adjustment', label: '修正 🛠️', color: 'bg-indigo-100 text-indigo-700' },
    { id: 'Good', label: '到位 👍', color: 'bg-green-100 text-green-700' },
    { id: 'Bad', label: '不到位 👎', color: 'bg-red-100 text-red-700' },
];

const PRESET_TEAMS: { name: string; roster: string[] }[] = [];

// --- Helper Logic for Full Court ---
const isOutOfBounds = (coord: Coordinate): boolean => {
    return coord.x < 10 || coord.x > 90 || coord.y < 10 || coord.y > 90;
};

const getFullCourtZone = (coord: Coordinate): Zone => {
    const isTopHalf = coord.y < 50;
    if (isTopHalf) {
        const row = coord.y > 34.67 ? 'Front' : 'Back';
        const col = coord.x < 35 ? 'Left' : coord.x < 65 ? 'Center' : 'Right';
        if (row === 'Back') return col === 'Left' ? 1 : col === 'Center' ? 6 : 5; 
        else return col === 'Left' ? 2 : col === 'Center' ? 3 : 4; 
    } else {
        const row = coord.y < 65.33 ? 'Front' : 'Back';
        const col = coord.x < 35 ? 'Left' : coord.x < 65 ? 'Center' : 'Right';
        if (row === 'Front') return col === 'Left' ? 4 : col === 'Center' ? 3 : 2;
        else return col === 'Left' ? 5 : col === 'Center' ? 6 : 1;
    }
};

// --- Smart Prediction Logic ---
const getSmartStartCoordinate = (team: TeamSide, skill: SkillType): Coordinate => {
    if (skill === 'Serve') return team === 'Home' ? { x: 80, y: 98 } : { x: 20, y: 2 };
    if (skill === 'Attack') return team === 'Home' ? { x: 20, y: 65 } : { x: 80, y: 35 };
    if (skill === 'Set') return team === 'Home' ? { x: 65, y: 55 } : { x: 35, y: 45 };
    return team === 'Home' ? { x: 50, y: 75 } : { x: 50, y: 25 };
};

// --- Role Persistence Helpers ---
const ROLE_STORAGE_KEY = 'volleyTag_PlayerRoles';

const getSavedPlayerRole = (teamName: string, number: string): PlayerRole => {
    try {
        const saved = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || '{}');
        return saved[`${teamName}-${number}`] || '?';
    } catch (e) {
        return '?';
    }
};

const savePlayerRole = (teamName: string, number: string, role: PlayerRole) => {
    try {
        const saved = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || '{}');
        saved[`${teamName}-${number}`] = role;
        localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {
        console.error("Failed to save role", e);
    }
};

// --- Helper Components ---

const Toast = ({ message, onClose }: { message: string, onClose: () => void }) => (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] animate-fade-in-down flex items-center gap-2">
        <AlertTriangle size={20} className="text-yellow-400" />
        <span className="font-bold">{message}</span>
    </div>
);

const ResetModal = ({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]">
        <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center">
            <AlertTriangle size={64} className="mx-auto text-red-500 mb-6" />
            <h2 className="text-2xl font-black text-slate-900 mb-2">確定要開新比賽？</h2>
            <p className="text-slate-600 mb-8 font-bold">此動作將會清除所有紀錄、名單與設定，且無法復原。</p>
            <div className="flex gap-4 justify-center">
                <button onClick={onCancel} className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-lg">取消</button>
                <button onClick={onConfirm} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-lg shadow-lg shadow-red-200">確定重置</button>
            </div>
        </div>
    </div>
);

const LogModal = ({ events, metadata, onClose, onDelete }: { events: TagEvent[], metadata: MatchMetadata, onClose: () => void, onDelete: (id: string) => void }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150]">
            <div className="bg-white rounded-xl w-[800px] h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2"><ScrollText /> 比賽紀錄明細 (Match Logs)</h3>
                    <button onClick={onClose} className="hover:bg-slate-700 p-1 rounded"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    {events.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <ScrollText size={48} className="mb-2 opacity-50" />
                            <p>尚無紀錄</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 font-bold shadow-sm text-sm">
                                <tr>
                                    <th className="p-3 border-b text-center w-16">局</th>
                                    <th className="p-3 border-b w-24">時間</th>
                                    <th className="p-3 border-b w-32">隊伍</th>
                                    <th className="p-3 border-b w-16 text-center">背號</th>
                                    <th className="p-3 border-b">動作</th>
                                    <th className="p-3 border-b w-20 text-center">結果</th>
                                    <th className="p-3 border-b w-16 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.slice().reverse().map((e, idx) => {
                                    const teamName = e.team === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name;
                                    const skillLabel = SKILLS.find(s => s.id === e.skill)?.label || e.skill;
                                    const subTypeLabel = e.subType ? ([...ATTACK_SUBTYPES, ...SERVE_SUBTYPES, ...FAULT_SUBTYPES, ...SET_SUBTYPES].find(s=>s.id===e.subType)?.label) : '';
                                    return (
                                        <tr key={e.id} className="border-b hover:bg-slate-50 text-sm">
                                            <td className="p-3 text-center font-bold text-slate-500">{e.set}</td>
                                            <td className="p-3 text-slate-500 font-mono">{e.matchTimeFormatted || '-'}</td>
                                            <td className={`p-3 font-bold ${e.team==='Home'?'text-blue-600':'text-red-600'}`}>{teamName}</td>
                                            <td className="p-3 text-center font-black">{e.playerNumber}</td>
                                            <td className="p-3">
                                                <span className="font-bold text-slate-700">{skillLabel}</span>
                                                {subTypeLabel && <span className="text-slate-400 text-xs ml-2">({subTypeLabel})</span>}
                                                {e.grade && <span className="ml-2 bg-slate-200 px-1 rounded text-xs">{e.grade}</span>}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${e.result==='Point'?'bg-green-100 text-green-700':e.result==='Error'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
                                                    {e.result === 'Point' ? '得分' : e.result === 'Error' ? '失誤' : '繼續'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => onDelete(e.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                    title="刪除 (無需確認)"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

const SubstitutionModal = ({ team, lineup, metadata, onClose, onConfirm }: any) => {
    const [outPlayer, setOutPlayer] = useState<Player|null>(null);
    const [inPlayer, setInPlayer] = useState<Player|null>(null);
    
    const roster = team === 'Home' ? metadata.homeTeam.roster : metadata.awayTeam.roster;
    const currentLineup = team === 'Home' ? lineup.home : lineup.away;
    const onCourtIds = Object.values(currentLineup).filter(p => p).map((p: any) => p.id);
    
    const starters = Object.values(currentLineup).filter((p): p is Player => p !== null).sort((a,b) => parseInt(a.number)-parseInt(b.number));
    const bench = roster.filter((p: Player) => !onCourtIds.includes(p.id)).sort((a: Player, b: Player) => parseInt(a.number)-parseInt(b.number));

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150]">
            <div className="bg-white rounded-xl w-[600px] overflow-hidden flex flex-col max-h-[80vh]">
                <div className={`p-4 text-white font-bold text-xl flex justify-between items-center ${team==='Home'?'bg-blue-600':'bg-red-600'}`}>
                    <span>{team === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name} - 換人</span>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6 grid grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-bold text-slate-500 mb-3 text-center">下場球員 (OUT)</h4>
                        <div className="space-y-2">
                            {starters.map(p => (
                                <button key={p.id} onClick={() => setOutPlayer(p)} className={`w-full p-3 rounded border font-bold flex items-center justify-between ${outPlayer?.id===p.id ? 'bg-red-50 border-red-500 ring-2 ring-red-200' : 'bg-white hover:bg-slate-50'}`}>
                                    <span className="bg-slate-800 text-white w-8 h-8 rounded flex items-center justify-center">{p.number}</span>
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-500 mb-3 text-center">上場球員 (IN)</h4>
                        <div className="space-y-2">
                            {bench.map(p => (
                                <button key={p.id} onClick={() => setInPlayer(p)} className={`w-full p-3 rounded border font-bold flex items-center justify-between ${inPlayer?.id===p.id ? 'bg-green-50 border-green-500 ring-2 ring-green-200' : 'bg-white hover:bg-slate-50'}`}>
                                    <span className="bg-slate-800 text-white w-8 h-8 rounded flex items-center justify-center">{p.number}</span>
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded">取消</button>
                    <button disabled={!outPlayer || !inPlayer} onClick={() => onConfirm(team, outPlayer, inPlayer)} className="px-6 py-2 bg-slate-800 text-white font-bold rounded disabled:opacity-50 hover:bg-slate-700">確認換人</button>
                </div>
            </div>
        </div>
    );
};

const MapLegend = () => (
    <div id="printable-legend" className="flex items-center justify-center gap-6 pb-2">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white ring-1 ring-green-600 shadow-sm"></div><span className="text-sm font-bold text-slate-600">得分 (Point)</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white ring-1 ring-red-600 shadow-sm"></div><span className="text-sm font-bold text-slate-600">失誤 (Error)</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white ring-1 ring-blue-600 shadow-sm"></div><span className="text-sm font-bold text-slate-600">發球失誤 (Serve Err)</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white ring-1 ring-gray-500 shadow-sm"></div><span className="text-sm font-bold text-slate-600">繼續 (Continue)</span></div>
    </div>
);

// --- Stats Dashboard (Full Feature) ---

const StatsDashboard = ({ metadata, events, onClose, currentScore }: any) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<TeamSide | null>(null);
    const [viewMode, setViewMode] = useState<'MatchSummary' | 'TeamStats' | 'PlayerStats' | 'MatchReport'>('MatchSummary');

    useEffect(() => {
        if (selectedPlayerId) {
            setViewMode('PlayerStats');
            setSelectedTeam(null);
        } else if (selectedTeam) {
            setViewMode('TeamStats');
            setSelectedPlayerId(null);
        } else if (viewMode !== 'MatchReport') {
            setViewMode('MatchSummary');
        }
    }, [selectedPlayerId, selectedTeam]);

    // Calculate Set Scores for Scoreboard
    const setScores = useMemo(() => {
        const scores: { set: number, home: number, away: number }[] = [];
        const maxSet = Math.max(...events.map((e:TagEvent) => e.set), 1);
        
        for (let s = 1; s <= maxSet; s++) {
            let h = 0, a = 0;
            events.filter((e: TagEvent) => e.set === s).forEach((e: TagEvent) => {
                if (e.result === 'Point') e.team === 'Home' ? h++ : a++;
                if (e.result === 'Error') e.team === 'Home' ? a++ : h++;
            });
            scores.push({ set: s, home: h, away: a });
        }
        return scores;
    }, [events]);

    // Calculate Match Summary Stats
    const summary = useMemo(() => {
        const stats = { Home: { points: 0, attackKills: 0, blocks: 0, aces: 0, opErrors: 0, selfErrors: 0 }, Away: { points: 0, attackKills: 0, blocks: 0, aces: 0, opErrors: 0, selfErrors: 0 } };
        events.forEach((e: TagEvent) => {
            const side = e.team;
            if (e.result === 'Point') {
                stats[side].points++;
                if (e.skill === 'Attack') stats[side].attackKills++;
                if (e.skill === 'Block') stats[side].blocks++;
                if (e.skill === 'Serve') stats[side].aces++;
            } else if (e.result === 'Error') {
                stats[side].selfErrors++;
                const opSide = side === 'Home' ? 'Away' : 'Home';
                stats[opSide].points++;
                stats[opSide].opErrors++;
            }
        });
        return stats;
    }, [events]);

    // Filter Events
    const filteredEvents = useMemo(() => {
        if (viewMode === 'PlayerStats' && selectedPlayerId) {
            return events.filter((e: TagEvent) => {
                const p = e.team === 'Home' ? metadata.homeTeam.roster.find((rp: Player) => rp.id === selectedPlayerId) : metadata.awayTeam.roster.find((rp: Player) => rp.id === selectedPlayerId);
                return p && e.playerNumber === p.number && e.team === (e.team === 'Home' ? 'Home' : 'Away'); 
            });
        } else if (viewMode === 'TeamStats' && selectedTeam) {
            return events.filter((e: TagEvent) => e.team === selectedTeam);
        }
        return [];
    }, [events, viewMode, selectedPlayerId, selectedTeam, metadata]);

    // Stats Calculation Helper
    const calculateStats = (evs: TagEvent[]) => {
        let points = 0, errors = 0, attacks = 0, kills = 0, aces = 0, digs = 0, blocks = 0;
        evs.forEach(e => {
            if (e.result === 'Point') points++;
            if (e.result === 'Error') errors++;
            if (e.skill === 'Attack') { attacks++; if (e.result === 'Point') kills++; }
            if (e.skill === 'Serve' && e.result === 'Point') aces++;
            if (e.skill === 'Dig') digs++;
            if (e.skill === 'Block' && e.result === 'Point') blocks++;
        });
        return { points, errors, attacks, kills, aces, digs, blocks };
    };

    const currentStats = calculateStats(filteredEvents);

    // Prepare Heatmap Data
    const getHeatmapData = (skill: SkillType, teamSide?: TeamSide) => {
        let sourceEvents = events;
        if (viewMode === 'MatchSummary' && teamSide) {
             sourceEvents = events.filter((e: TagEvent) => e.team === teamSide);
        } else if (viewMode !== 'MatchSummary') {
             sourceEvents = filteredEvents;
        }

        const skillEvents = sourceEvents.filter((e: TagEvent) => e.skill === skill);
        
        const points = skillEvents
            .filter(e => e.endCoordinate && !e.startCoordinate)
            .map(e => ({ ...e.endCoordinate!, result: e.result, skill: e.skill })); // Add skill
            
        const trajectories = skillEvents
            .filter(e => e.startCoordinate && e.endCoordinate)
            .map(e => ({ start: e.startCoordinate!, end: e.endCoordinate!, result: e.result, skill: e.skill })); // Add skill

        return { points, trajectories };
    };

    const renderNumericComparison = (label: string, homeVal: number, awayVal: number) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div className="text-2xl font-black text-blue-600 w-16 text-center">{homeVal}</div>
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-2xl font-black text-red-600 w-16 text-center">{awayVal}</div>
        </div>
    );

    const activeTeamName = selectedTeam 
        ? (selectedTeam === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name)
        : (selectedPlayerId && metadata.homeTeam.roster.some((p:Player)=>p.id===selectedPlayerId) ? metadata.homeTeam.name : metadata.awayTeam.name);
    
    const activePlayer = selectedPlayerId 
        ? (metadata.homeTeam.roster.find((p:Player)=>p.id===selectedPlayerId) || metadata.awayTeam.roster.find((p:Player)=>p.id===selectedPlayerId)) 
        : null;

    // Print Helper
    const handlePrint = (title: string, elementId: string, stats?: any) => {
        const content = document.getElementById(elementId);
        const legend = document.getElementById('printable-legend'); // Grab the legend
        if (!content || !legend) return;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        // Generate Stats HTML (Enlarged for Print)
        const statsHtml = stats ? `
            <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 30px; border: 4px solid #ccc; padding: 25px; border-radius: 16px; background-color: #f9fafb; width: 100%;">
                <div style="text-align: center;"><div style="font-size: 18px; color: #666; font-weight: bold; margin-bottom: 5px;">總得分</div><div style="font-size: 48px; font-weight: 900; color: #333;">${stats.points}</div></div>
                <div style="text-align: center;"><div style="font-size: 18px; color: #666; font-weight: bold; margin-bottom: 5px;">總失誤</div><div style="font-size: 48px; font-weight: 900; color: #ef4444;">${stats.errors}</div></div>
                <div style="text-align: center;"><div style="font-size: 18px; color: #666; font-weight: bold; margin-bottom: 5px;">攻擊效率</div><div style="font-size: 48px; font-weight: 900; color: #3b82f6;">${stats.attacks > 0 ? Math.round(((stats.kills - stats.errors)/stats.attacks)*100)+'%' : '-'}</div></div>
                <div style="text-align: center;"><div style="font-size: 18px; color: #666; font-weight: bold; margin-bottom: 5px;">發球得分</div><div style="font-size: 48px; font-weight: 900; color: #333;">${stats.aces}</div></div>
                <div style="text-align: center;"><div style="font-size: 18px; color: #666; font-weight: bold; margin-bottom: 5px;">攔網得分</div><div style="font-size: 48px; font-weight: 900; color: #3b82f6;">${stats.blocks}</div></div>
            </div>
        ` : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 20px; display: flex; flex-direction: column; align-items: center; }
                        h1 { text-align: center; margin-bottom: 20px; font-weight: 900; font-size: 48px !important; line-height: 1.1; color: #000; }
                        .legend-container { margin-bottom: 20px; transform: scale(1.5); }
                        .stats-container { width: 95%; max-width: 900px; margin-bottom: 30px; }
                        /* FORCE HEIGHT FOR PRINTING - FIT A4 */
                        .print-content { width: 100%; height: 200mm; position: relative; page-break-inside: avoid; border: 4px solid #ddd; border-radius: 12px; overflow: hidden; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    </style>
                </head>
                <body class="bg-white">
                    <h1>${title}</h1>
                    <div class="legend-container">
                        ${legend.outerHTML}
                    </div>
                    <div class="stats-container">
                        ${statsHtml}
                    </div>
                    <div class="print-content">
                        ${content.innerHTML}
                    </div>
                    <script>
                        setTimeout(() => { window.print(); window.close(); }, 1500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // --- Generate Match Insight Report ---
    const report = useMemo(() => {
        const home = summary.Home;
        const away = summary.Away;
        const winner = home.points > away.points ? metadata.homeTeam.name : (away.points > home.points ? metadata.awayTeam.name : '平手');
        
        // MVP Logic
        const findMVP = (team: TeamSide) => {
            const roster = team === 'Home' ? metadata.homeTeam.roster : metadata.awayTeam.roster;
            let bestPlayer = null;
            let maxPoints = -1;
            roster.forEach((p: Player) => {
                const s = calculateStats(events.filter((e:TagEvent) => e.team === team && e.playerNumber === p.number));
                if(s.points > maxPoints) { maxPoints = s.points; bestPlayer = { ...p, stats: s }; }
            });
            return bestPlayer;
        };
        const homeMVP = findMVP('Home');
        const awayMVP = findMVP('Away');

        // Efficiency
        const getEff = (side: TeamSide) => {
            const evs = events.filter((e: TagEvent) => e.team === side && e.skill === 'Attack');
            const k = evs.filter((e:TagEvent)=>e.result==='Point').length;
            const err = evs.filter((e:TagEvent)=>e.result==='Error').length;
            const total = evs.length;
            return total > 0 ? Math.round(((k-err)/total)*100) : 0;
        };
        const homeEff = getEff('Home');
        const awayEff = getEff('Away');

        return {
            winner,
            homeMVP,
            awayMVP,
            homeEff,
            awayEff,
            homeWeakness: home.selfErrors > 10 ? '失誤過多，需加強穩定性' : home.blocks < 3 ? '攔網得分較少，需加強網前防守' : '表現尚可，保持節奏',
            awayWeakness: away.selfErrors > 10 ? '失誤過多，需加強穩定性' : away.blocks < 3 ? '攔網得分較少，需加強網前防守' : '表現尚可，保持節奏'
        };
    }, [summary, events, metadata]);

    return (
        <div className="absolute inset-0 bg-slate-50 z-[60] flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
                <h2 className="text-xl font-bold flex items-center gap-2"><BarChart2 /> 數據分析儀表板</h2>
                <div className="flex gap-4">
                    <button onClick={() => { setSelectedPlayerId(null); setSelectedTeam(null); setViewMode('MatchReport'); }} className={`px-4 py-2 rounded font-bold text-sm ${viewMode === 'MatchReport' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}><span className="flex items-center gap-1"><ClipboardList size={16}/> 賽後報告</span></button>
                    <button onClick={() => { setSelectedPlayerId(null); setSelectedTeam(null); setViewMode('MatchSummary'); }} className={`px-4 py-2 rounded font-bold text-sm ${viewMode === 'MatchSummary' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>比賽總結</button>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-sm">返回比賽</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
                {/* Left Roster (Home) */}
                <div className="w-64 bg-white border-r flex flex-col overflow-y-auto">
                    <button onClick={() => setSelectedTeam('Home')} className={`p-4 font-black text-lg border-b text-center hover:bg-blue-50 ${selectedTeam === 'Home' ? 'bg-blue-100 text-blue-800' : 'text-blue-600'}`}>{metadata.homeTeam.name}</button>
                    {metadata.homeTeam.roster.map((p: Player) => (
                        <button key={p.id} onClick={() => setSelectedPlayerId(p.id)} className={`p-3 border-b flex items-center gap-3 hover:bg-slate-50 ${selectedPlayerId === p.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                            <span className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm">{p.number}</span>
                            <span className="font-bold text-slate-700 text-sm truncate">{p.name}</span>
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 bg-slate-100 p-6 overflow-y-auto">
                    {/* ... (Report Content) ... */}
                    {viewMode === 'MatchReport' ? (
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg print:shadow-none">
                            <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
                                <h1 className="text-3xl font-black text-slate-900 mb-2">排球賽後分析報告</h1>
                                <div className="text-slate-500 font-bold">{metadata.tournament} | {metadata.date}</div>
                                <div className="mt-4 text-xl font-bold flex justify-center gap-4 items-center">
                                    <span className="text-blue-600">{metadata.homeTeam.name}</span>
                                    <span className="bg-slate-800 text-white px-3 py-1 rounded">{summary.Home.points} - {summary.Away.points}</span>
                                    <span className="text-red-600">{metadata.awayTeam.name}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8">
                                {/* Home Analysis */}
                                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                    <h3 className="text-xl font-black text-blue-800 mb-4 flex items-center gap-2"><Activity size={20}/> {metadata.homeTeam.name} 表現</h3>
                                    <ul className="space-y-3 text-slate-700">
                                        <li className="flex justify-between border-b border-blue-200 pb-1"><span>攻擊效率</span> <span className="font-bold">{report.homeEff}%</span></li>
                                        <li className="flex justify-between border-b border-blue-200 pb-1"><span>總失誤</span> <span className="font-bold text-red-600">{summary.Home.selfErrors}</span></li>
                                        <li className="flex justify-between border-b border-blue-200 pb-1"><span>發球得分</span> <span className="font-bold">{summary.Home.aces}</span></li>
                                        <li className="pt-2"><span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded font-bold mr-2">MVP</span> <span className="font-bold">{report.homeMVP ? `#${report.homeMVP.number} ${report.homeMVP.name} (${report.homeMVP.stats.points}分)` : '無'}</span></li>
                                    </ul>
                                </div>
                                {/* Away Analysis */}
                                <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                                    <h3 className="text-xl font-black text-red-800 mb-4 flex items-center gap-2"><Activity size={20}/> {metadata.awayTeam.name} 表現</h3>
                                    <ul className="space-y-3 text-slate-700">
                                        <li className="flex justify-between border-b border-red-200 pb-1"><span>攻擊效率</span> <span className="font-bold">{report.awayEff}%</span></li>
                                        <li className="flex justify-between border-b border-red-200 pb-1"><span>總失誤</span> <span className="font-bold text-red-600">{summary.Away.selfErrors}</span></li>
                                        <li className="flex justify-between border-b border-red-200 pb-1"><span>發球得分</span> <span className="font-bold">{summary.Away.aces}</span></li>
                                        <li className="pt-2"><span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded font-bold mr-2">MVP</span> <span className="font-bold">{report.awayMVP ? `#${report.awayMVP.number} ${report.awayMVP.name} (${report.awayMVP.stats.points}分)` : '無'}</span></li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 mb-8">
                                <h3 className="text-xl font-black text-yellow-800 mb-4 flex items-center gap-2"><AlertTriangle size={20}/> 教練建議與加強方向</h3>
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <div className="font-bold text-blue-800 mb-1">{metadata.homeTeam.name}:</div>
                                        <p className="text-slate-700 leading-relaxed">{report.homeWeakness}</p>
                                        <p className="text-slate-600 text-sm mt-2">建議：{report.homeEff < 30 ? '增加攻擊多樣性，避免被單人攔網封死。' : '維持攻擊節奏，減少非受迫性失誤。'}</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-red-800 mb-1">{metadata.awayTeam.name}:</div>
                                        <p className="text-slate-700 leading-relaxed">{report.awayWeakness}</p>
                                        <p className="text-slate-600 text-sm mt-2">建議：{report.awayEff < 30 ? '增加攻擊多樣性，避免被單人攔網封死。' : '維持攻擊節奏，減少非受迫性失誤。'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : viewMode === 'MatchSummary' ? (
                        <div className="max-w-5xl mx-auto space-y-6">
                            {/* Scoreboard Table */}
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <table className="w-full text-center">
                                    <thead className="bg-slate-900 text-white text-sm">
                                        <tr>
                                            <th className="p-3 text-left w-48">隊伍</th>
                                            {[1,2,3,4,5].map(s => <th key={s} className="p-3 w-16">Set {s}</th>)}
                                            <th className="p-3 w-20 bg-slate-800">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-bold text-lg">
                                        <tr className="border-b">
                                            <td className="p-3 text-left text-blue-600">{metadata.homeTeam.name}</td>
                                            {[1,2,3,4,5].map(s => {
                                                const score = setScores.find(sc => sc.set === s);
                                                return <td key={s} className="p-3 text-slate-700">{score ? score.home : '-'}</td>
                                            })}
                                            <td className="p-3 bg-slate-100 text-blue-800">{summary.Home.points}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 text-left text-red-600">{metadata.awayTeam.name}</td>
                                            {[1,2,3,4,5].map(s => {
                                                const score = setScores.find(sc => sc.set === s);
                                                return <td key={s} className="p-3 text-slate-700">{score ? score.away : '-'}</td>
                                            })}
                                            <td className="p-3 bg-slate-100 text-red-800">{summary.Away.points}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Numeric Comparison */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm">
                                <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">攻守數據對比</h3>
                                <div className="max-w-2xl mx-auto">
                                    {renderNumericComparison("總得分 (Points)", summary.Home.points, summary.Away.points)}
                                    {renderNumericComparison("攻擊得分 (Kills)", summary.Home.attackKills, summary.Away.attackKills)}
                                    {renderNumericComparison("攔網得分 (Blocks)", summary.Home.blocks, summary.Away.blocks)}
                                    {renderNumericComparison("發球得分 (Aces)", summary.Home.aces, summary.Away.aces)}
                                    {renderNumericComparison("對手失誤贈分 (Op. Err)", summary.Home.opErrors, summary.Away.opErrors)}
                                    {renderNumericComparison("自身總失誤 (Errors)", summary.Home.selfErrors, summary.Away.selfErrors)}
                                </div>
                            </div>

                            {/* Side-by-Side Full Court Heatmaps */}
                            <MapLegend />
                            <div className="grid grid-cols-2 gap-6 h-[600px]">
                                <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-blue-700 text-lg">{metadata.homeTeam.name} 攻擊熱區</h3>
                                        <button onClick={() => handlePrint(`${metadata.homeTeam.name} 攻擊熱區`, 'summary-heatmap-home', calculateStats(events.filter(e => e.team === 'Home')))} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="列印熱區"><Printer size={20}/></button>
                                    </div>
                                    <div id="summary-heatmap-home" className="flex-1 border-4 border-slate-300 rounded-xl overflow-hidden bg-orange-50 relative">
                                        <CourtMap label="" trajectoryMode={false} compact heatmapPoints={getHeatmapData('Attack', 'Home').points} trajectories={getHeatmapData('Attack', 'Home').trajectories} netPosition="center" watermark={metadata.homeTeam.name} topWatermark={metadata.awayTeam.name} bottomWatermark={metadata.homeTeam.name} />
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-red-700 text-lg">{metadata.awayTeam.name} 攻擊熱區</h3>
                                        <button onClick={() => handlePrint(`${metadata.awayTeam.name} 攻擊熱區`, 'summary-heatmap-away', calculateStats(events.filter(e => e.team === 'Away')))} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="列印熱區"><Printer size={20}/></button>
                                    </div>
                                    <div id="summary-heatmap-away" className="flex-1 border-4 border-slate-300 rounded-xl overflow-hidden bg-orange-50 relative">
                                        <CourtMap label="" trajectoryMode={false} compact heatmapPoints={getHeatmapData('Attack', 'Away').points} trajectories={getHeatmapData('Attack', 'Away').trajectories} netPosition="center" watermark={metadata.awayTeam.name} topWatermark={metadata.homeTeam.name} bottomWatermark={metadata.awayTeam.name} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto">
                             <div className="flex items-center gap-4 mb-6">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg ${selectedTeam === 'Home' || metadata.homeTeam.roster.some((p:Player)=>p.id===selectedPlayerId) ? 'bg-blue-600' : 'bg-red-600'}`}>
                                    {selectedTeam ? 'T' : (activePlayer?.number || '')}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-800">{activeTeamName}</h2>
                                    <div className="text-slate-500 font-bold">{selectedTeam ? '全隊數據總覽' : activePlayer?.name}</div>
                                </div>
                             </div>

                             <div className="grid grid-cols-4 gap-4 mb-8">
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500"><div className="text-sm text-slate-500 font-bold mb-1">總得分</div><div className="text-3xl font-black text-slate-800">{currentStats.points}</div></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500"><div className="text-sm text-slate-500 font-bold mb-1">總失誤</div><div className="text-3xl font-black text-slate-800">{currentStats.errors}</div></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-500"><div className="text-sm text-slate-500 font-bold mb-1">攻擊效率</div><div className="text-3xl font-black text-slate-800">{currentStats.attacks > 0 ? Math.round(((currentStats.kills - currentStats.errors)/currentStats.attacks)*100)+'%' : '-'}</div></div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-purple-500"><div className="text-sm text-slate-500 font-bold mb-1">攔網得分</div><div className="text-3xl font-black text-slate-800">{currentStats.blocks}</div></div>
                             </div>

                             {/* Detailed Team Table */}
                             {selectedTeam && (
                                 <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
                                     <div className="p-4 border-b font-bold bg-slate-50">球員詳細數據表</div>
                                     <table className="w-full text-sm text-left">
                                         <thead className="bg-white text-slate-500">
                                             <tr>
                                                 <th className="p-3"># 姓名</th>
                                                 <th className="p-3 text-center">總得分</th>
                                                 <th className="p-3 text-center">攻擊(得/失)</th>
                                                 <th className="p-3 text-center">攔網得分</th>
                                                 <th className="p-3 text-center">發球得分</th>
                                                 <th className="p-3 text-center">總失誤</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {(selectedTeam === 'Home' ? metadata.homeTeam.roster : metadata.awayTeam.roster).map((p: Player) => {
                                                 const pStats = calculateStats(events.filter((e: TagEvent) => e.playerNumber === p.number && e.team === selectedTeam));
                                                 if (pStats.points === 0 && pStats.errors === 0 && pStats.attacks === 0 && pStats.digs === 0) return null;
                                                 return (
                                                     <tr key={p.id} className="border-t hover:bg-slate-50">
                                                         <td className="p-3 font-bold"><span className={`inline-block w-6 h-6 text-center leading-6 text-white rounded mr-2 ${selectedTeam==='Home'?'bg-blue-600':'bg-red-600'}`}>{p.number}</span>{p.name}</td>
                                                         <td className="p-3 text-center font-black">{pStats.points}</td>
                                                         <td className="p-3 text-center">{pStats.kills} / <span className="text-red-500">{pStats.errors}</span></td>
                                                         <td className="p-3 text-center">{pStats.blocks}</td>
                                                         <td className="p-3 text-center">{pStats.aces}</td>
                                                         <td className="p-3 text-center text-red-600 font-bold">{pStats.errors}</td>
                                                     </tr>
                                                 );
                                             })}
                                         </tbody>
                                     </table>
                                 </div>
                             )}

                             {/* Full Court Heatmaps */}
                             <MapLegend />
                             <div className="grid grid-cols-2 gap-6 h-[600px]">
                                <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-slate-700 text-lg">發球落點 (Serve)</h3>
                                        <button onClick={() => {
                                            const title = activePlayer 
                                                ? `${activeTeamName} #${activePlayer.number} ${activePlayer.name} 發球落點`
                                                : `${activeTeamName} 發球落點`;
                                            handlePrint(title, 'single-heatmap-serve', currentStats);
                                        }} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="列印熱區"><Printer size={20}/></button>
                                    </div>
                                    <div id="single-heatmap-serve" className="flex-1 border-4 border-slate-300 rounded-xl overflow-hidden bg-orange-50 relative">
                                        <CourtMap label="" trajectoryMode={false} compact heatmapPoints={getHeatmapData('Serve').points} trajectories={getHeatmapData('Serve').trajectories} netPosition="center" watermark={activeTeamName} topWatermark={selectedTeam === 'Home' ? metadata.awayTeam.name : metadata.homeTeam.name} bottomWatermark={activeTeamName} />
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-slate-700 text-lg">攻擊落點 (Attack)</h3>
                                        <button onClick={() => {
                                            const title = activePlayer 
                                                ? `${activeTeamName} #${activePlayer.number} ${activePlayer.name} 攻擊落點`
                                                : `${activeTeamName} 攻擊落點`;
                                            handlePrint(title, 'single-heatmap-attack', currentStats);
                                        }} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="列印熱區"><Printer size={20}/></button>
                                    </div>
                                    <div id="single-heatmap-attack" className="flex-1 border-4 border-slate-300 rounded-xl overflow-hidden bg-orange-50 relative">
                                        <CourtMap label="" trajectoryMode={false} compact heatmapPoints={getHeatmapData('Attack').points} trajectories={getHeatmapData('Attack').trajectories} netPosition="center" watermark={activeTeamName} topWatermark={selectedTeam === 'Home' ? metadata.awayTeam.name : metadata.homeTeam.name} bottomWatermark={activeTeamName} />
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Right Roster (Away) */}
                <div className="w-64 bg-white border-l flex flex-col overflow-y-auto">
                    <button onClick={() => setSelectedTeam('Away')} className={`p-4 font-black text-lg border-b text-center hover:bg-red-50 ${selectedTeam === 'Away' ? 'bg-red-100 text-red-800' : 'text-red-600'}`}>{metadata.awayTeam.name}</button>
                    {metadata.awayTeam.roster.map((p: Player) => (
                        <button key={p.id} onClick={() => setSelectedPlayerId(p.id)} className={`p-3 border-b flex items-center gap-3 hover:bg-slate-50 ${selectedPlayerId === p.id ? 'bg-red-50 border-l-4 border-l-red-500' : ''}`}>
                            <span className="w-8 h-8 rounded bg-red-600 text-white flex items-center justify-center font-bold text-sm">{p.number}</span>
                            <span className="font-bold text-slate-700 text-sm truncate">{p.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const STORAGE_KEY = 'volleyTagData_Base2'; 

const VolleyTagApp: React.FC<{ onResetApp: () => void, user: User, onLogout: () => void }> = ({ onResetApp, user, onLogout }) => {
  const [phase, setPhase] = useState<'setup' | 'lineup' | 'recording' | 'stats'>('setup');
  
  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [metadata, setMetadata] = useState<MatchMetadata>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).metadata : {
      date: new Date().toISOString().split('T')[0],
      tournament: '',
      homeTeam: { name: '', roster: [] },
      awayTeam: { name: '', roster: [] }
    };
  });

  const [lineup, setLineup] = useState<Lineup>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).lineup : {
      home: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, L: null },
      away: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, L: null }
    };
  });

  const [events, setEvents] = useState<TagEvent[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).events : [];
  });

  const [score, setScore] = useState<{home: number, away: number}>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).score : { home: 0, away: 0 };
  });

  const [currentSet, setCurrentSet] = useState<number>(1);
  const [servingTeam, setServingTeam] = useState<TeamSide>('Home');
  const [manualInputs, setManualInputs] = useState<{Home: { number: string; name: string }; Away: { number: string; name: string };}>({ Home: { number: '', name: '' }, Away: { number: '', name: '' } });
  const [showBatchImport, setShowBatchImport] = useState<{Home: boolean, Away: boolean}>({ Home: false, Away: false });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const [userSavedTeams, setUserSavedTeams] = useState<Team[]>(() => {
      try {
          const saved = localStorage.getItem('volleyTag_UserTeams');
          return saved ? JSON.parse(saved) : [];
      } catch(e) { return []; }
  });

  const [pendingEvent, setPendingEvent] = useState<Partial<TagEvent>>({});
  const [showSubModal, setShowSubModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [subTeam, setSubTeam] = useState<TeamSide>('Home');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- HOISTED FUNCTION: DEFINED BEFORE USAGE ---
  const handleRotate = (teamSide: TeamSide) => {
    setLineup(prev => {
      const current = prev[teamSide === 'Home' ? 'home' : 'away'];
      const newPos = { 1: current[2], 2: current[3], 3: current[4], 4: current[5], 5: current[6], 6: current[1], L: current.L };
      if (newPos[1]?.role === 'MB' && newPos.L) {
          const mb = newPos[1]; newPos[1] = newPos.L; newPos.L = mb;
          setNotification(`${teamSide === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name}: 自由球員自動替換快攻手`);
      }
      if (newPos[4]?.role === 'L' && newPos.L) {
          const lib = newPos[4]; newPos[4] = newPos.L; newPos.L = lib;
           setNotification(`${teamSide === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name}: 快攻手自動回到前排`);
      }
      return { ...prev, [teamSide === 'Home' ? 'home' : 'away']: newPos };
    });
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ metadata, lineup, events, score }));
  }, [metadata, lineup, events, score]);

  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleNextPhase = () => {
    if (phase === 'setup') {
        if (metadata.homeTeam.roster.length < 7) {
            setNotification(`⚠️ ${metadata.homeTeam.name || '主隊'} 人數不足 (至少 7 人)`);
            return;
        }
        if (metadata.awayTeam.roster.length < 7) {
            setNotification(`⚠️ ${metadata.awayTeam.name || '客隊'} 人數不足 (至少 7 人)`);
            return;
        }
        setPhase('lineup');
    }
    else if (phase === 'lineup') setPhase('recording');
  };

  const handleBackPhase = () => {
    if (phase === 'lineup') setPhase('setup');
    else if (phase === 'recording') setPhase('lineup');
  };

  const handleTeamImport = (side: TeamSide, teamName: string) => {
      const allTeams = [...PRESET_TEAMS, ...userSavedTeams];
      const selected = allTeams.find(t => t.name === teamName);
      
      if (!selected) return;

      let parsedRoster: Player[] = [];
      
      if (typeof selected.roster[0] === 'string') {
           parsedRoster = (selected.roster as any[]).map(line => {
              const parts = line.trim().split(/\s+/);
              const savedRole = getSavedPlayerRole(teamName, parts[0]);
              return { id: crypto.randomUUID(), number: parts[0], name: parts[1] || '', role: savedRole };
          });
      } else {
           parsedRoster = (selected.roster as any[]).map(p => ({
               ...p,
               id: crypto.randomUUID(), 
               role: getSavedPlayerRole(teamName, p.number) 
           }));
      }

      setMetadata(prev => {
          const key = side === 'Home' ? 'homeTeam' : 'awayTeam';
          return { ...prev, [key]: { name: selected.name, roster: parsedRoster } };
      });
      setNotification(`✅ 成功匯入 ${selected.name}`);
  };

  const handleSaveTeam = (side: TeamSide) => {
      const team = side === 'Home' ? metadata.homeTeam : metadata.awayTeam;
      const cleanName = team.name.trim(); 

      console.log(`[Save] Attempting to save team. Clean Name: "${cleanName}"`);

      if (!cleanName) {
          setNotification("請輸入隊伍名稱");
          return;
      }
      if (team.roster.length === 0) {
          setNotification("隊伍名單不能為空");
          return;
      }

      const teamToSave = { ...team, name: cleanName };

      const existingIndex = userSavedTeams.findIndex(t => t.name.trim().toLowerCase() === cleanName.toLowerCase());
      
      let newSaved;
      if (existingIndex >= 0) {
          newSaved = [...userSavedTeams];
          newSaved[existingIndex] = teamToSave;
      } else {
          newSaved = [...userSavedTeams, teamToSave];
      }

      setUserSavedTeams(newSaved);
      localStorage.setItem('volleyTag_UserTeams', JSON.stringify(newSaved));
      
      setMetadata(prev => {
          const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
          return { ...prev, [teamKey]: { ...prev[teamKey], name: cleanName } };
      });

      setNotification(`✅ 已將「${cleanName}」儲存至資料庫`);
  };

  const handleDeleteTeam = (side: TeamSide) => {
      const team = side === 'Home' ? metadata.homeTeam : metadata.awayTeam;
      const teamName = String(team.name || '').trim();

      if (!teamName) {
          setNotification("錯誤：隊名為空");
          return;
      }

      const hasEvents = events.some(e => e.team === side);
      if (hasEvents) {
          setNotification("⚠️ 無法刪除：此隊伍已有比賽紀錄 (In Use)");
          return;
      }

      const otherSideKey = side === 'Home' ? 'awayTeam' : 'homeTeam';
      const otherTeamName = metadata[otherSideKey].name.trim();
      if (otherTeamName && otherTeamName.toLowerCase() === teamName.toLowerCase()) {
           setNotification("⚠️ 無法刪除：此隊伍正被對手使用中");
           return;
      }

      const initialLength = userSavedTeams.length;
      
      const newSaved = userSavedTeams.filter(t => {
          if (!t || !t.name) return false; 
          return String(t.name).trim().toLowerCase() !== teamName.toLowerCase();
      });
      
      if (newSaved.length < initialLength) {
          setUserSavedTeams(newSaved);
          localStorage.setItem('volleyTag_UserTeams', JSON.stringify(newSaved));
          setNotification(`🗑️ 已強制刪除「${teamName}」`);

          setMetadata(prev => {
              const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
              return { ...prev, [teamKey]: { name: '', roster: [] } };
          });
          setManualInputs(prev => ({ ...prev, [side]: { number: '', name: '' } }));
          setEditingPlayerId(null);

      } else {
          setNotification(`⚠️ 刪除無效：找不到名為「${teamName}」的存檔`);
      }
  };

  const handleClearTeamInfo = (side: TeamSide) => {
      setMetadata(prev => {
          const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
          return { ...prev, [teamKey]: { name: '', roster: [] } };
      });
      setManualInputs(prev => ({ ...prev, [side]: { number: '', name: '' } }));
      setEditingPlayerId(null);
      setNotification("已重置隊伍資訊");
  };

  const handleRandomSetup = () => {
      const homeRoster = ['1 測試A', '2 測試B', '3 測試C', '4 測試D', '5 測試E', '6 測試F', '7 測試G'];
      const awayRoster = ['1 測試X', '2 測試Y', '3 測試Z', '4 測試W', '5 測試V', '6 測試U', '7 測試T'];
      
      const parse = (list: string[], tName: string) => list.map(s => {
          const parts = s.split(' ');
          return { id: crypto.randomUUID(), number: parts[0], name: parts[1] || '', role: getSavedPlayerRole(tName, parts[0]) };
      });

      setMetadata(prev => ({ 
          ...prev, 
          tournament: '測試比賽 2024',
          homeTeam: { name: '測試主隊', roster: parse(homeRoster, '測試主隊') },
          awayTeam: { name: '測試客隊', roster: parse(awayRoster, '測試客隊') }
      }));
      setNotification('⚡ 測試資料已填入');
  };

  const handleRandomLineup = () => {
      const sides: TeamSide[] = ['Home', 'Away'];
      sides.forEach(side => {
          const team = side === 'Home' ? metadata.homeTeam : metadata.awayTeam;
          if (team.roster.length < 7) return;
          
          const newRoles: {[key in Zone]: Player} & {L: Player} = {} as any;
          const defaultRoles: PlayerRole[] = ['S', 'OH', 'MB', 'OP', 'OH', 'MB'];
          
          for(let i=1; i<=6; i++) {
              // @ts-ignore
              newRoles[i as Zone] = { ...team.roster[i-1], role: defaultRoles[i-1] };
          }
          newRoles.L = { ...team.roster[6], role: 'L' };

          setLineup(prev => ({
              ...prev,
              [side === 'Home' ? 'home' : 'away']: newRoles
          }));
      });
      setNotification('⚡ 隨機陣容已填入');
  };

  const handleSimulateSet = () => {
      const targetHome = Math.random() > 0.5 ? 25 : 23;
      const targetAway = targetHome === 25 ? 23 : 25;
      
      let simHome = 0; 
      let simAway = 0;
      const newEvents: TagEvent[] = [];
      
      while (simHome < targetHome || simAway < targetAway) {
          let side: TeamSide = 'Home';
          if (simHome === targetHome) side = 'Away';
          else if (simAway === targetAway) side = 'Home';
          else side = Math.random() > 0.5 ? 'Home' : 'Away';
          
          const team = side === 'Home' ? metadata.homeTeam : metadata.awayTeam;
          const player = team.roster[Math.floor(Math.random() * Math.min(team.roster.length, 7))];
          
          const rand = Math.random();
          let skill: SkillType = 'Attack';
          if (rand > 0.7) skill = 'Attack'; 
          else if (rand > 0.85) skill = 'Block';
          else if (rand > 0.95) skill = 'Serve';
          else skill = 'Fault'; 

          if (skill === 'Fault') skill = 'Attack'; 

          let startY = 50;
          let endY = 50;
          let startX = 15 + Math.random() * 70; 
          let endX = 15 + Math.random() * 70; 

          if (side === 'Home') {
              if (skill === 'Serve') {
                  startY = 95 + Math.random() * 4; 
              } else {
                  startY = 60 + Math.random() * 25; 
              }
              endY = 15 + Math.random() * 30; 
          } else {
              if (skill === 'Serve') {
                  startY = 1 + Math.random() * 4; 
              } else {
                  startY = 15 + Math.random() * 25; 
              }
              endY = 60 + Math.random() * 30; 
          }

          newEvents.push({
              id: `sim-${Date.now()}-${newEvents.length}`,
              timestamp: 0,
              matchTimeFormatted: 'SIM',
              team: side,
              playerNumber: player?.number || '1',
              skill: skill,
              result: 'Point',
              startZone: 1, endZone: 1,
              startCoordinate: { x: startX, y: startY },
              endCoordinate: { x: endX, y: endY },
              set: currentSet,
              tags: ['Simulation']
          });
          
          if (side === 'Home') simHome++; else simAway++;
      }
      
      setEvents(prev => [...prev, ...newEvents]);
      setScore(prev => ({ home: prev.home + simHome, away: prev.away + simAway }));
      setNotification(`⚡ 已模擬比分至 ${score.home + simHome}:${score.away + simAway}`);
  };

  const processBulk = (side: TeamSide, text: string) => {
      const lines = text.trim().split('\n');
      const newPlayers: Player[] = [];
      lines.forEach(line => {
          const match = line.trim().match(/^(\d+)[\.\,\-\s]*(.*)$/); 
          if (match) {
              const number = match[1];
              let name = match[2] ? match[2].trim() : '';
              
              const teamName = side === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name;
              const savedRole = getSavedPlayerRole(teamName, number);
              newPlayers.push({ id: crypto.randomUUID(), number: number, name: name, role: savedRole });
          }
      });

      if (newPlayers.length > 0) {
          setMetadata(prev => {
              const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
              const currentRoster = prev[teamKey].roster;
              const uniqueNew = newPlayers.filter(np => !currentRoster.some(cp => cp.number === np.number));
              return { ...prev, [teamKey]: { ...prev[teamKey], roster: [...currentRoster, ...uniqueNew].sort((a,b) => parseInt(a.number) - parseInt(b.number)) } };
          });
          setNotification(`批次匯入 ${newPlayers.length} 名球員`);
          setShowBatchImport(prev => ({ ...prev, [side]: false })); 
      } else {
          setNotification("⚠️ 未偵測到有效球員資料 (格式: 背號 姓名)");
      }
  };

  const handleStartEditing = (side: TeamSide, player: Player) => {
      setEditingPlayerId(player.id);
      setManualInputs(prev => ({
          ...prev,
          [side]: { number: player.number, name: player.name }
      }));
  };

  const handleCancelEdit = (side: TeamSide) => {
      setEditingPlayerId(null);
      setManualInputs(prev => ({ ...prev, [side]: { number: '', name: '' } }));
  };

  const addManualPlayer = (side: TeamSide) => {
    const input = manualInputs[side];
    if(!input.number.trim()) return;
    
    const teamName = side === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name;
    const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';

    if (editingPlayerId) {
        setMetadata(prev => {
            const currentRoster = prev[teamKey].roster;
            if (currentRoster.some(p => p.number === input.number.trim() && p.id !== editingPlayerId)) {
                setNotification(`背號 ${input.number.trim()} 已存在`);
                return prev;
            }
            const updatedRoster = currentRoster.map(p => {
                if (p.id === editingPlayerId) {
                    return { ...p, number: input.number.trim(), name: input.name.trim() };
                }
                return p;
            }).sort((a,b) => parseInt(a.number) - parseInt(b.number));

            return { ...prev, [teamKey]: { ...prev[teamKey], roster: updatedRoster } };
        });
        setEditingPlayerId(null);
        setNotification("球員資料已更新");
    } else {
        const savedRole = getSavedPlayerRole(teamName, input.number.trim());
        setMetadata(prev => {
            const currentRoster = prev[teamKey].roster;
            const newPlayer: Player = { id: crypto.randomUUID(), number: input.number.trim(), name: input.name.trim(), role: savedRole };
            if(currentRoster.some(p => p.number === newPlayer.number)) {
                setNotification(`背號 ${newPlayer.number} 已存在`);
                return prev;
            }
            return { ...prev, [teamKey]: { ...prev[teamKey], roster: [...currentRoster, newPlayer].sort((a,b) => parseInt(a.number) - parseInt(b.number)) } };
        });
    }
    
    setManualInputs(prev => ({ ...prev, [side]: { number: '', name: '' } }));
  };

  const removePlayer = (side: TeamSide, playerId: string) => {
      if (editingPlayerId === playerId) {
          handleCancelEdit(side);
      }
      setMetadata(prev => {
          const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
          return { ...prev, [teamKey]: { ...prev[teamKey], roster: prev[teamKey].roster.filter(p => p.id !== playerId) } };
      });
  };

  const clearRoster = (side: TeamSide) => {
      setMetadata(prev => {
          const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
          return { ...prev, [teamKey]: { ...prev[teamKey], roster: [] } };
      });
      setManualInputs(prev => ({ ...prev, [side]: { number: '', name: '' } }));
      setShowBatchImport(prev => ({ ...prev, [side]: false }));
      setEditingPlayerId(null);
      setNotification(`已清空 ${side === 'Home' ? '我方' : '對方'} 名單`);
  };

  const handleRoleChange = (teamSide: TeamSide, player: Player, newRole: PlayerRole, zone: Zone) => {
      setLineup(prev => {
          const sideKey = teamSide === 'Home' ? 'home' : 'away';
          const teamLineup = { ...prev[sideKey] };
          // @ts-ignore
          if (teamLineup[zone]?.id === player.id) {
               // @ts-ignore
               teamLineup[zone] = { ...player, role: newRole };
          }
          return { ...prev, [sideKey]: teamLineup };
      });

      const teamName = teamSide === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name;
      savePlayerRole(teamName, player.number, newRole);

      setMetadata(prev => {
          const teamKey = teamSide === 'Home' ? 'homeTeam' : 'awayTeam';
          return {
              ...prev,
              [teamKey]: {
                  ...prev[teamKey],
                  roster: prev[teamKey].roster.map(rp => rp.number === player.number ? { ...rp, role: newRole } : rp)
              }
          };
      });
  };

  // Drag and Drop handlers...
  const handleLineupDragStart = (e: React.DragEvent, player: Player, team: TeamSide, fromZone?: string) => {
      e.dataTransfer.setData('player', JSON.stringify({ player, team, fromZone }));
  };

  const handleLineupDrop = (e: React.DragEvent, targetZone: string, targetTeam: TeamSide) => {
      e.preventDefault();
      try {
          const data = JSON.parse(e.dataTransfer.getData('player'));
          if (data.team !== targetTeam) return;

          let playerToUse = data.player;
          
          if (targetZone === 'L') {
              playerToUse = { ...data.player, role: 'L' };
              const teamName = targetTeam === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name;
              savePlayerRole(teamName, playerToUse.number, 'L');
              setMetadata(prev => {
                  const teamKey = targetTeam === 'Home' ? 'homeTeam' : 'awayTeam';
                  const updatedRoster = prev[teamKey].roster.map((p: Player) => 
                      p.id === playerToUse.id ? { ...p, role: 'L' } : p
                  );
                  return { ...prev, [teamKey]: { ...prev[teamKey], roster: updatedRoster } };
              });
          }

          setLineup(prev => {
              const sideKey = targetTeam === 'Home' ? 'home' : 'away';
              const teamLineup = { ...prev[sideKey] };

              if (data.fromZone) {
                  // @ts-ignore
                  const existingPlayer = teamLineup[targetZone];
                  // @ts-ignore
                  teamLineup[targetZone] = playerToUse; 
                  // @ts-ignore
                  teamLineup[data.fromZone] = existingPlayer; 
              } else {
                  (Object.keys(teamLineup) as string[]).forEach(k => {
                      // @ts-ignore
                      if (teamLineup[k]?.id === playerToUse.id) teamLineup[k] = null;
                  });
                  // @ts-ignore
                  teamLineup[targetZone] = playerToUse;
              }
              return { ...prev, [sideKey]: teamLineup };
          });
      } catch (err) {
          console.error("Drop error", err);
      }
  };

  const handleRosterDrop = (e: React.DragEvent, targetTeam: TeamSide) => {
      e.preventDefault();
      try {
          const data = JSON.parse(e.dataTransfer.getData('player'));
          if (data.team !== targetTeam) return;
          if (!data.fromZone) return; 

          setLineup(prev => {
              const sideKey = targetTeam === 'Home' ? 'home' : 'away';
              const teamLineup = { ...prev[sideKey] };
              // @ts-ignore
              teamLineup[data.fromZone] = null;
              return { ...prev, [sideKey]: teamLineup };
          });
      } catch (err) {
          console.error("Roster drop error", err);
      }
  };

  // Handler for player selection - Smart Prediction
  const handleSelectPlayer = (team: TeamSide, player: Player) => {
    // If a skill is already selected, update start point for new team/player context
    const start = pendingEvent.skill ? getSmartStartCoordinate(team, pendingEvent.skill) : pendingEvent.startCoordinate;
    
    setPendingEvent(prev => ({ 
        ...prev, 
        team, 
        playerNumber: player.number, 
        timestamp: 0,
        startCoordinate: start
    })); 
  };

  // Handler for skill selection - Smart Prediction
  const handleSelectSkill = (skill: SkillType) => {
      const team = pendingEvent.team;
      // Predict start point based on team and skill
      const start = team ? getSmartStartCoordinate(team, skill) : undefined;
      
      setPendingEvent(prev => ({ 
          ...prev, 
          skill, 
          subType: undefined, 
          result: undefined, // Reset result
          startCoordinate: start // Set predicted start
      }));
  };

  const commitEvent = (result: ResultType) => {
    if (!pendingEvent.team || !pendingEvent.playerNumber || !pendingEvent.skill) {
       setNotification("請選擇球員與動作");
       return;
    }
    let sZone = pendingEvent.startZone;
    let eZone = pendingEvent.endZone;
    
    if (!sZone && pendingEvent.startCoordinate) sZone = getFullCourtZone(pendingEvent.startCoordinate);
    if (!eZone && pendingEvent.endCoordinate) eZone = getFullCourtZone(pendingEvent.endCoordinate);
    
    if (!sZone) sZone = 1;
    if (!eZone) eZone = 1;

    const newEvent: TagEvent = {
      id: Date.now().toString(),
      timestamp: 0,
      matchTimeFormatted: new Date().toLocaleTimeString(),
      team: pendingEvent.team,
      playerNumber: pendingEvent.playerNumber,
      skill: pendingEvent.skill,
      subType: pendingEvent.subType,
      grade: pendingEvent.grade,
      startZone: sZone,
      endZone: eZone,
      startCoordinate: pendingEvent.startCoordinate,
      endCoordinate: pendingEvent.endCoordinate,
      result: result,
      set: currentSet,
      tags: pendingEvent.tags,
    };

    setEvents(prev => [...prev, newEvent]);
    
    let pointWinner: TeamSide | null = null;
    if (result === 'Point') {
        setScore(prev => ({ ...prev, [newEvent.team === 'Home' ? 'home' : 'away']: prev[newEvent.team === 'Home' ? 'home' : 'away'] + 1 }));
        pointWinner = newEvent.team;
    } else if (result === 'Error') {
        setScore(prev => ({ ...prev, [newEvent.team === 'Home' ? 'away' : 'home']: prev[newEvent.team === 'Home' ? 'away' : 'home'] + 1 }));
        pointWinner = newEvent.team === 'Home' ? 'Away' : 'Home';
    }

    if (pointWinner && pointWinner !== servingTeam) {
        handleRotate(pointWinner);
        setServingTeam(pointWinner);
        setNotification("換發球：自動輪轉");
    }

    setPendingEvent({});
  };

  const handleDeleteEvent = (id: string) => {
      const updatedEvents = events.filter(e => e.id !== id);
      setEvents(updatedEvents);

      let newHome = 0;
      let newAway = 0;
      updatedEvents.filter(e => e.set === currentSet).forEach(e => {
          if (e.result === 'Point') {
              e.team === 'Home' ? newHome++ : newAway++;
          } else if (e.result === 'Error') {
              e.team === 'Home' ? newAway++ : newHome++;
          }
      });
      setScore({ home: newHome, away: newAway });
      setNotification('已刪除紀錄並更新比分');
  };

  const handleSubstitution = (teamSide: TeamSide, outP: Player, inP: Player) => {
      const actualInPlayer = { ...inP, role: (inP.role && inP.role !== '?') ? inP.role : outP.role };

      setLineup(prev => {
          const teamLineup = prev[teamSide === 'Home' ? 'home' : 'away'];
          const newLineup = { ...teamLineup };
          (Object.keys(newLineup) as any[]).forEach(key => { if ((newLineup as any)[key]?.id === outP.id) (newLineup as any)[key] = actualInPlayer; });
          return { ...prev, [teamSide === 'Home' ? 'home' : 'away']: newLineup };
      });
      setEvents(prev => [...prev, { id: Date.now().toString(), timestamp: 0, matchTimeFormatted: '', team: teamSide, playerNumber: actualInPlayer.number, skill: 'Substitution', startZone: 1, endZone: 1, result: 'Continue', set: currentSet, tags: [`${outP.number} OUT, ${actualInPlayer.number} IN`] } as TagEvent]);
      setShowSubModal(false);
  };

  // ... [Export functions] ...
  const exportCSV = () => {
    const bom = "\uFEFF";
    const headers = ["局", "時間", "隊伍", "背號", "姓名", "角色", "動作", "子類型", "評分", "標籤", "起始位置", "起始 X%", "起始 Y%", "落點位置", "落點 X%", "落點 Y%", "結果"];
    const rows = events.map(e => {
      const teamRoster = e.team === 'Home' ? metadata.homeTeam.roster : metadata.awayTeam.roster;
      let player = teamRoster.find(p => p.number === e.playerNumber);
      if (!player) {
          const currentLineup = e.team === 'Home' ? lineup.home : lineup.away;
          player = (Object.values(currentLineup) as (Player | null)[]).find(p => p && p.number === e.playerNumber) as Player | undefined;
      }
      const playerName = player ? player.name : '';
      let playerRole = '未定';
      if (player && player.role && player.role !== '?') {
          const r = ROLES.find(role => role.id === player.role);
          if (r) playerRole = r.label;
      }
      return [
        e.set, e.matchTimeFormatted, e.team === 'Home' ? metadata.homeTeam.name : metadata.awayTeam.name, e.playerNumber,
        playerName, playerRole, SKILLS.find(s=>s.id===e.skill)?.label || e.skill,
        e.subType ? ([...ATTACK_SUBTYPES, ...SERVE_SUBTYPES, ...FAULT_SUBTYPES, ...SET_SUBTYPES].find(s=>s.id===e.subType)?.label || e.subType) : '',
        e.grade ? GRADES.find(g=>g.id===e.grade)?.label : '',
        e.tags?.map(t => TAGS.find(tag => tag.id === t)?.label || t).join(', '),
        e.startZone, e.startCoordinate?.x.toFixed(2), e.startCoordinate?.y.toFixed(2),
        e.endZone, e.endCoordinate?.x.toFixed(2), e.endCoordinate?.y.toFixed(2),
        e.result === 'Point' ? '得分' : e.result === 'Error' ? '失誤' : '繼續'
      ];
    });
    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `volleyball_stats_${new Date().toISOString()}.csv`;
    link.click();
  };

  const exportJSON = () => {
    const backup = { metadata, lineup, events, score };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `volleytag_backup_${new Date().toISOString()}.json`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans h-screen overflow-hidden">
      {notification && <Toast message={notification} onClose={() => setNotification(null)} />}
      {showSubModal && <SubstitutionModal team={subTeam} lineup={lineup} metadata={metadata} onClose={()=>setShowSubModal(false)} onConfirm={handleSubstitution} />}
      {showLogModal && <LogModal events={events} metadata={metadata} onClose={() => setShowLogModal(false)} onDelete={handleDeleteEvent} />}
      {resetModalOpen && <ResetModal onConfirm={onResetApp} onCancel={() => setResetModalOpen(false)} />}
      {phase === 'stats' && <StatsDashboard metadata={metadata} events={events} score={score} onClose={() => setPhase('recording')} />}

      {/* Header */}
      <header className="bg-slate-900 text-white p-3 shadow-md flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3">
             {(phase === 'lineup' || phase === 'recording') && <button onClick={handleBackPhase} className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"><ChevronLeft /> 上一步</button>}
             <div className="w-px h-6 bg-slate-700 mx-2"></div>
             <div className="flex items-center gap-2"><Activity className="text-blue-400" /><h1 className="text-xl font-bold tracking-tight">VolleyTag Pro</h1></div>
             {phase === 'recording' && (
                 <>
                    <button onClick={() => setPhase('stats')} className="ml-4 bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded flex items-center gap-2 text-sm font-bold border border-slate-600 transition-colors"><BarChart2 size={16}/> 數據分析</button>
                    <button onClick={() => setShowLogModal(true)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded flex items-center gap-2 text-sm font-bold border border-slate-600 transition-colors"><ScrollText size={16}/> 比賽紀錄</button>
                    <button onClick={handleSimulateSet} className="bg-indigo-700 hover:bg-indigo-600 px-3 py-1 rounded flex items-center gap-2 text-sm font-bold border border-indigo-500 transition-colors"><Zap size={16}/> 模擬 23:25</button>
                 </>
             )}
        </div>
        <div className="flex gap-3 items-center">
             <button onClick={exportJSON} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-bold text-sm"><Save size={16} /> 備份</button>
             {phase !== 'setup' && phase !== 'lineup' && <button onClick={exportCSV} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 px-4 py-2 rounded font-bold text-sm"><Download size={16} /> CSV</button>}
             <button onClick={() => setResetModalOpen(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-50 px-4 py-2 rounded font-bold text-sm"><RotateCcw size={16} /> 開新比賽</button>
             
             {/* User Profile Section */}
             <div className="flex items-center gap-3 pl-4 border-l border-slate-700 ml-2">
                <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-8 h-8 rounded-full border border-slate-500" />
                <span className="text-sm font-bold hidden md:block text-slate-300 max-w-[100px] truncate" title={user.displayName || ''}>{user.displayName}</span>
                <button onClick={onLogout} className="text-slate-400 hover:text-white transition-colors" title="登出">
                    <LogOut size={20} />
                </button>
             </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* SETUP & LINEUP PHASES UNCHANGED ... */}
        {/* SETUP PHASE */}
        {phase === 'setup' && (
             <div className="w-full h-full flex items-start justify-center p-4 md:p-6 overflow-y-auto mt-4 mb-12">
                 <div className="bg-white border border-slate-200 shadow-xl rounded-2xl w-[95%] flex flex-col shrink-0">
                     <div className="p-8 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                         <div><h2 className="text-3xl font-black text-slate-800 mb-2">賽前設定 (Match Setup)</h2></div>
                         <div className="flex-wrap flex gap-4">
                            <button onClick={handleRandomSetup} className="bg-orange-500 hover:bg-orange-400 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2" title="一鍵自動填入測試用隊伍與球員"><Zap size={20}/> 測試資料</button>
                            <label className="cursor-pointer bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2">
                                <Upload size={20}/> 匯入備份
                                <input type="file" className="hidden" accept=".json" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => { try { const data = JSON.parse(ev.target?.result as string); setMetadata(data.metadata); setLineup(data.lineup); setEvents(data.events); setScore(data.score); setPhase('recording'); } catch (err) { alert("無效的備份檔"); } };
                                        reader.readAsText(file);
                                    }
                                }}/>
                            </label>
                            <button onClick={handleNextPhase} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-green-200 flex items-center gap-2">下一步 <ChevronRight /></button>
                         </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                         {(['Home', 'Away'] as const).map((side, idx) => {
                             const teamKey = side === 'Home' ? 'homeTeam' : 'awayTeam';
                             const team = metadata[teamKey];
                             
                             // 1. Get Clean Current Name for comparison
                             const currentTeamName = team.name.trim();
                             
                             // 2. Robust 'isSaved' check: Compare trimmed & lowercased names
                             const isSaved = userSavedTeams.some(t => t.name.trim().toLowerCase() === currentTeamName.toLowerCase());
                             
                             // Logic to control the Select Value
                             const matchingSaved = userSavedTeams.find(t => t.name.trim().toLowerCase() === currentTeamName.toLowerCase());
                             const matchingPreset = PRESET_TEAMS.find(t => t.name.toLowerCase() === currentTeamName.toLowerCase());
                             const selectValue = matchingSaved ? matchingSaved.name : (matchingPreset ? matchingPreset.name : "");

                             return (
                             <div key={side} className="flex flex-col gap-6">
                                 <h3 className={`text-2xl font-black ${idx===0?'text-blue-600':'text-red-600'}`}>{idx===0?'我方隊伍 (Home)':'對方隊伍 (Away)'}</h3>
                                 
                                 {/* NEW LAYOUT: Input and Buttons in One Flex Row (Reduced height and padding for shrink effect) */}
                                 <div className="flex items-center gap-2 h-12">
                                     <div className="relative flex-1 min-w-0 h-full">
                                         <input 
                                            type="text" 
                                            placeholder="輸入隊伍名稱..." 
                                            className={`w-full h-full px-3 text-lg font-bold border-2 border-slate-300 rounded-lg focus:border-blue-500 bg-white text-black ${isSaved ? 'pr-10' : ''}`}
                                            value={team.name} 
                                            onChange={(e) => setMetadata({...metadata, [teamKey]: {...team, name: e.target.value}})}
                                         />
                                         {isSaved && (
                                             <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600 flex items-center bg-white pl-1 pointer-events-none" title="已存檔">
                                                 <CheckCircle size={20} fill="#dcfce7" />
                                             </div>
                                         )}
                                     </div>
                                     
                                     {/* Action Buttons Group */}
                                     <div className="flex gap-1 shrink-0 h-full">
                                         <button 
                                            onClick={() => handleClearTeamInfo(side)}
                                            className="bg-slate-200 text-slate-600 hover:bg-slate-300 px-3 rounded-lg flex flex-col items-center justify-center font-bold text-xs gap-0.5 shadow-md border border-slate-300 w-16"
                                            title="重置：清空目前隊伍名稱與名單 (Reset Team)"
                                         >
                                             <Eraser size={18} />
                                             <span>重置</span>
                                         </button>

                                         <button 
                                            onClick={() => handleSaveTeam(side)}
                                            className="bg-slate-700 text-white px-3 rounded-lg hover:bg-slate-600 flex flex-col items-center justify-center font-bold text-xs gap-0.5 shadow-md border border-slate-800 w-16"
                                            title="儲存此隊伍到我的資料庫"
                                         >
                                             <FolderHeart size={18} />
                                             <span>存隊伍</span>
                                         </button>
                                         
                                         <button 
                                            onClick={() => isSaved ? handleDeleteTeam(side) : null}
                                            disabled={!isSaved}
                                            className={`px-3 rounded-lg flex flex-col items-center justify-center font-bold text-xs gap-0.5 shadow-md border w-16 transition-colors
                                                ${isSaved 
                                                    ? 'bg-red-600 text-white hover:bg-red-700 border-red-800 cursor-pointer' 
                                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                            title={isSaved ? `永久刪除「${team.name}」` : "無法刪除：尚未儲存或為預設隊伍"}
                                         >
                                             {isSaved ? <Trash2 size={18} /> : <Lock size={18} />}
                                             <span>{isSaved ? '刪除' : '鎖定'}</span>
                                         </button>
                                     </div>
                                 </div>

                                 <div className="flex items-center">
                                     <select 
                                        className="w-full p-3 border-2 border-slate-300 rounded-xl font-bold text-slate-700 focus:border-blue-500" 
                                        value={selectValue}
                                        onChange={(e) => handleTeamImport(side, e.target.value)}
                                     >
                                         <option value="">-- 從資料庫快速選擇 --</option>
                                         <optgroup label={`我的儲存隊伍 (${userSavedTeams.length})`}>
                                             {userSavedTeams.map(t => <option key={`user-${t.name}`} value={t.name}>{t.name}</option>)}
                                         </optgroup>
                                         <optgroup label="預設隊伍 (不可刪除)">
                                             {PRESET_TEAMS.map(t => <option key={`preset-${t.name}`} value={t.name}>{t.name}</option>)}
                                         </optgroup>
                                     </select>
                                 </div>

                                 {/* Roster UI ... */}
                                 <div className="flex gap-2 items-center flex-wrap">
                                    <input 
                                        type="text" 
                                        placeholder="背號" 
                                        className="w-24 p-3 border-2 border-slate-300 rounded-xl font-bold text-center text-lg" 
                                        value={manualInputs[side].number} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setManualInputs(prev => ({...prev, [side]: {...prev[side], number: val}}))
                                        }} 
                                        onKeyDown={e => e.key === 'Enter' && addManualPlayer(side)}
                                    />
                                    <input type="text" placeholder="姓名 (可留空)" className="flex-1 min-w-[120px] p-3 border-2 border-slate-300 rounded-xl font-bold text-lg" value={manualInputs[side].name} onChange={e => setManualInputs(prev => ({...prev, [side]: {...prev[side], name: e.target.value}}))} onKeyDown={e => e.key === 'Enter' && addManualPlayer(side)}/>
                                    
                                    {/* Edit / Add Buttons */}
                                    {editingPlayerId && metadata[teamKey].roster.some(p => p.id === editingPlayerId) ? (
                                        <>
                                            <button onClick={() => addManualPlayer(side)} className="bg-green-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-green-500 flex items-center gap-2 animate-pulse shadow-lg shadow-green-200">更新</button>
                                            <button onClick={() => handleCancelEdit(side)} className="bg-slate-200 text-slate-600 px-3 py-3 rounded-xl font-bold hover:bg-slate-300"><X size={20}/></button>
                                        </>
                                    ) : (
                                        <button onClick={() => addManualPlayer(side)} className="bg-slate-800 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-700 flex items-center gap-2"><Plus size={20} /> 新增</button>
                                    )}

                                    <button onClick={() => setShowBatchImport(prev => ({...prev, [side]: !prev[side]}))} className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 border ${showBatchImport[side] ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><FileText size={20} /> 批次</button>
                                    <button type="button" onClick={() => clearRoster(side)} className="px-4 py-3 rounded-xl font-bold flex items-center gap-2 border bg-white text-red-500 hover:bg-red-50 border-red-200"><Trash2 size={20} /> 清空</button>
                                 </div>
                                 {showBatchImport[side] && (
                                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fade-in-down">
                                         <p className="text-xs text-slate-500 mb-2 font-bold">請貼上球員名單 (格式: 背號 姓名，支援從 Excel 複製，姓名可省略)</p>
                                         <textarea className="w-full h-32 p-3 border rounded-lg text-sm font-mono mb-2" placeholder="1 王小明&#10;5" onBlur={(e) => processBulk(side, e.target.value)}></textarea>
                                     </div>
                                 )}
                                 <div key={`${team.name}-${team.roster.length}`} className="border-2 border-slate-200 rounded-xl p-2 h-[350px] bg-slate-50 overflow-y-auto">
                                     <div className="grid grid-cols-2 gap-2">
                                         {team.roster.map(p => (
                                             <div key={p.id} className={`p-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between group ${editingPlayerId === p.id ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200' : 'bg-white'}`}>
                                                 <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded flex items-center justify-center font-black text-white text-sm ${idx===0?'bg-blue-600':'bg-red-600'}`}>{p.number}</span><span className="font-bold text-sm truncate">{p.name}</span></div>
                                                 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                     <button onClick={()=>handleStartEditing(side, p)} className="text-slate-400 hover:text-blue-500 p-1 bg-slate-100 rounded mr-1"><Pencil size={16} /></button>
                                                     <button onClick={()=>removePlayer(side, p.id)} className="text-slate-400 hover:text-red-500 p-1 bg-slate-100 rounded"><Trash2 size={16} /></button>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             </div>
                         )})}
                     </div>
                 </div>
             </div>
        )}

        {/* PHASE 2: LINEUP */}
        {phase === 'lineup' && (
            <div className="h-full w-full flex bg-slate-50 relative">
                 {/* Left Roster */}
                 <div className="w-80 bg-white border-r flex flex-col" onDragOver={e => e.preventDefault()} onDrop={e => handleRosterDrop(e, 'Home')}>
                     <h3 className="p-4 font-black text-xl bg-blue-100 text-blue-800 border-b border-blue-200 text-center">{metadata.homeTeam.name}</h3>
                     <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        {metadata.homeTeam.roster.map(p => {
                            const isUsed = (Object.values(lineup.home) as (Player|null)[]).some(lp => lp?.id === p.id);
                            return (
                                <div key={p.id} draggable onDragStart={(e) => handleLineupDragStart(e, p, 'Home')} className={`p-2 rounded flex items-center gap-4 cursor-grab active:cursor-grabbing border h-14 ${isUsed ? 'opacity-40 bg-slate-100' : 'bg-white border-blue-100 hover:border-blue-400'}`}>
                                    <div className="w-10 h-10 rounded bg-blue-600 text-white flex items-center justify-center font-black shrink-0 text-xl">{p.number}</div>
                                    <div className="font-bold text-slate-700 truncate text-xl">{p.name}</div>
                                </div>
                            );
                        })}
                     </div>
                 </div>
                 {/* Center Court */}
                 <div className="flex-1 bg-orange-50 relative overflow-hidden flex flex-col justify-center items-center p-4">
                     <div className="w-full max-w-4xl h-full flex flex-col gap-4 relative">
                         <div className="absolute top-0 right-0 z-20 flex gap-2">
                            <button onClick={handleRandomLineup} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg flex items-center gap-2" title="隨機分配陣容"><Zap size={20}/></button>
                            <button onClick={handleNextPhase} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black text-xl shadow-lg flex items-center gap-2"><Play size={24} fill="currentColor" /> 開始比賽</button>
                         </div>
                         <div className="flex-1 bg-orange-100 border-4 border-white shadow-2xl relative flex flex-col rounded-xl overflow-hidden">
                             {/* AWAY TEAM (TOP) */}
                             <div className="flex-1 relative border-b-4 border-slate-300/50 flex flex-col">
                                 <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-6xl font-black -rotate-12 text-red-900 select-none">{metadata.awayTeam.name}</div>
                                 <div className="flex-1 flex border-b border-orange-200/50 relative">
                                     {[1, 6, 5].map(z => (<div key={z} className="flex-1 border-r border-orange-200/50 relative flex items-center justify-center" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, z.toString(), 'Away')}> 
                                        <span className="absolute top-2 left-2 text-red-200 font-bold text-xl">{z}</span> 
                                        {lineup.away[z as Zone] ? (<div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.away[z as Zone]!, 'Away', z.toString())} className="text-center flex flex-col items-center cursor-grab active:cursor-grabbing w-full h-full justify-center"> <div className="text-4xl font-black text-red-600">{lineup.away[z as Zone]?.number}</div> <div className="text-3xl font-bold text-red-800">{lineup.away[z as Zone]?.name}</div> 
                                        <select 
                                            className="mt-1 text-xl font-bold border rounded p-0.5 bg-white/80" 
                                            value={lineup.away[z as Zone]?.role || '?'} 
                                            onChange={(e) => { 
                                                const p = lineup.away[z as Zone];
                                                if (p) handleRoleChange('Away', p, e.target.value as PlayerRole, z as Zone);
                                            }} 
                                            onClick={e => e.stopPropagation()}
                                        > 
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)} 
                                        </select> 
                                        </div>) : <span className="text-red-300 font-bold text-xl">拖曳</span>} 
                                     </div>))}
                                 </div>
                                 <div className="flex-1 flex relative">
                                     {[2, 3, 4].map(z => (<div key={z} className="flex-1 border-r border-orange-200/50 relative flex items-center justify-center" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, z.toString(), 'Away')}> 
                                        <span className="absolute top-2 left-2 text-red-200 font-bold text-xl">{z}</span> 
                                        {lineup.away[z as Zone] ? (<div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.away[z as Zone]!, 'Away', z.toString())} className="text-center flex flex-col items-center cursor-grab active:cursor-grabbing w-full h-full justify-center"> <div className="text-4xl font-black text-red-600">{lineup.away[z as Zone]?.number}</div> <div className="text-3xl font-bold text-red-800">{lineup.away[z as Zone]?.name}</div> 
                                        <select 
                                            className="mt-1 text-xl font-bold border rounded p-0.5 bg-white/80" 
                                            value={lineup.away[z as Zone]?.role || '?'} 
                                            onChange={(e) => { 
                                                const p = lineup.away[z as Zone];
                                                if (p) handleRoleChange('Away', p, e.target.value as PlayerRole, z as Zone);
                                            }} 
                                            onClick={e => e.stopPropagation()}
                                        > 
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)} 
                                        </select> 
                                        </div>) : <span className="text-red-300 font-bold text-xl">拖曳</span>} 
                                     </div>))}
                                     {/* AWAY LIBERO: Right 33% (intersection of 3/4/5/6) */}
                                     <div className="absolute right-[33.33%] top-1/2 translate-x-1/2 -translate-y-1/2 w-28 h-32 bg-yellow-50 border-4 border-dashed border-yellow-400 rounded-xl flex flex-col items-center justify-center z-20 shadow-xl" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, 'L', 'Away')}> 
                                        <span className="text-lg font-black text-yellow-600 mb-1">自由 (L)</span> 
                                        {lineup.away.L ? <div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.away.L!, 'Away', 'L')} className="text-4xl font-black text-red-600 cursor-grab active:cursor-grabbing">{lineup.away.L.number}</div> : null} 
                                     </div>
                                 </div>
                             </div>
                             {/* NET */}
                             <div className="h-4 bg-slate-800 w-full z-20 flex items-center justify-center shadow-lg"><span className="text-xs text-white font-bold tracking-widest">NET</span></div>
                             {/* HOME TEAM (BOTTOM) */}
                             <div className="flex-1 relative flex flex-col">
                                 <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-6xl font-black -rotate-12 text-blue-900 select-none">{metadata.homeTeam.name}</div>
                                 <div className="flex-1 flex border-b border-orange-200/50 relative">
                                     {[4, 3, 2].map(z => (<div key={z} className="flex-1 border-r border-orange-200/50 relative flex items-center justify-center" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, z.toString(), 'Home')}> 
                                        <span className="absolute top-2 left-2 text-blue-200 font-bold text-xl">{z}</span> 
                                        {lineup.home[z as Zone] ? (<div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.home[z as Zone]!, 'Home', z.toString())} className="text-center flex flex-col items-center cursor-grab active:cursor-grabbing w-full h-full justify-center"> <div className="text-4xl font-black text-blue-600">{lineup.home[z as Zone]?.number}</div> <div className="text-3xl font-bold text-blue-800">{lineup.home[z as Zone]?.name}</div> 
                                        <select 
                                            className="mt-1 text-xl font-bold border rounded p-0.5 bg-white/80" 
                                            value={lineup.home[z as Zone]?.role || '?'} 
                                            onChange={(e) => { 
                                                const p = lineup.home[z as Zone];
                                                if (p) handleRoleChange('Home', p, e.target.value as PlayerRole, z as Zone);
                                            }} 
                                            onClick={e => e.stopPropagation()}
                                        > 
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)} 
                                        </select> 
                                        </div>) : <span className="text-blue-300 font-bold text-xl">拖曳</span>} 
                                     </div>))}
                                     {/* HOME LIBERO: Left 33% (intersection of 3/4/5/6) */}
                                     <div className="absolute left-[33.33%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-32 bg-yellow-50 border-4 border-dashed border-yellow-400 rounded-xl flex flex-col items-center justify-center z-20 shadow-xl" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, 'L', 'Home')}> 
                                        <span className="text-lg font-black text-yellow-600 mb-1">自由 (L)</span> 
                                        {lineup.home.L ? <div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.home.L!, 'Home', 'L')} className="text-4xl font-black text-blue-600 cursor-grab active:cursor-grabbing">{lineup.home.L.number}</div> : null} 
                                     </div>
                                 </div>
                                 <div className="flex-1 flex">
                                     {[5, 6, 1].map(z => (<div key={z} className="flex-1 border-r border-orange-200/50 relative flex items-center justify-center" onDragOver={e => e.preventDefault()} onDrop={e => handleLineupDrop(e, z.toString(), 'Home')}> 
                                        <span className="absolute top-2 left-2 text-blue-200 font-bold text-xl">{z}</span> 
                                        {lineup.home[z as Zone] ? (<div draggable onDragStart={(e) => handleLineupDragStart(e, lineup.home[z as Zone]!, 'Home', z.toString())} className="text-center flex flex-col items-center cursor-grab active:cursor-grabbing w-full h-full justify-center"> <div className="text-4xl font-black text-blue-600">{lineup.home[z as Zone]?.number}</div> <div className="text-3xl font-bold text-blue-800">{lineup.home[z as Zone]?.name}</div> 
                                        <select 
                                            className="mt-1 text-xl font-bold border rounded p-0.5 bg-white/80" 
                                            value={lineup.home[z as Zone]?.role || '?'} 
                                            onChange={(e) => { 
                                                const p = lineup.home[z as Zone];
                                                if (p) handleRoleChange('Home', p, e.target.value as PlayerRole, z as Zone);
                                            }} 
                                            onClick={e => e.stopPropagation()}
                                        > 
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)} 
                                        </select> 
                                        </div>) : <span className="text-blue-300 font-bold text-xl">拖曳</span>} 
                                     </div>))}
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
                 {/* Right Roster */}
                 <div className="w-80 bg-white border-l flex flex-col" onDragOver={e => e.preventDefault()} onDrop={e => handleRosterDrop(e, 'Away')}>
                     <h3 className="p-4 font-black text-xl bg-red-100 text-red-800 border-b border-red-200 text-center">{metadata.awayTeam.name}</h3>
                     <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        {metadata.awayTeam.roster.map(p => {
                            const isUsed = (Object.values(lineup.away) as (Player|null)[]).some(lp => lp?.id === p.id);
                            return (
                                <div key={p.id} draggable onDragStart={(e) => handleLineupDragStart(e, p, 'Away')} className={`p-2 rounded flex items-center gap-4 cursor-grab active:cursor-grabbing border h-14 ${isUsed ? 'opacity-40 bg-slate-100' : 'bg-white border-red-100 hover:border-red-400'}`}>
                                    <div className="w-10 h-10 rounded bg-red-600 text-white flex items-center justify-center font-black shrink-0 text-xl">{p.number}</div>
                                    <div className="font-bold text-slate-700 truncate text-xl">{p.name}</div>
                                </div>
                            );
                        })}
                     </div>
                 </div>
            </div>
        )}

        {/* PHASE 3: RECORDING */}
        {phase === 'recording' && (
            <div className="h-full w-full flex bg-slate-50 overflow-hidden">
                {/* LEFT (50%): Scoreboard, Visual Roster, Video Player */}
                <div className="w-1/2 flex flex-col border-r border-slate-300 bg-white h-full">
                    {/* Scoreboard... */}
                    <div className="bg-slate-900 text-white p-2 flex justify-between items-center shadow-md shrink-0 z-10">
                         <div className="text-xs text-slate-500 font-bold uppercase tracking-wider w-16">Set {currentSet}</div>
                         <div className="flex-1 flex items-center justify-center gap-6">
                            <div className="flex flex-col items-end">
                                <div className={`text-lg font-black cursor-pointer flex items-center gap-2 ${servingTeam==='Home'?'text-blue-400':'text-slate-300'}`} onClick={()=>setServingTeam('Home')}>{servingTeam==='Home'&&'🏐'} {metadata.homeTeam.name}</div>
                                <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity"><button onClick={()=>setScore(s=>({...s, home: s.home+1}))} className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded text-xs hover:bg-green-600">+</button><button onClick={()=>setScore(s=>({...s, home: s.home-1}))} className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded text-xs hover:bg-red-600">-</button></div>
                            </div>
                            <div className="text-4xl font-black font-mono tracking-tighter bg-slate-800 px-4 py-1 rounded-lg border border-slate-700"><span className="text-blue-500">{score.home}</span><span className="text-slate-500 mx-2">-</span><span className="text-red-500">{score.away}</span></div>
                            <div className="flex flex-col items-start">
                                <div className={`text-lg font-black cursor-pointer flex items-center gap-2 ${servingTeam==='Away'?'text-red-400':'text-slate-300'}`} onClick={()=>setServingTeam('Away')}>{metadata.awayTeam.name} {servingTeam==='Away'&&'🏐'}</div>
                                <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity"><button onClick={()=>setScore(s=>({...s, away: s.away+1}))} className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded text-xs hover:bg-green-600">+</button><button onClick={()=>setScore(s=>({...s, away: s.away-1}))} className="w-6 h-6 flex items-center justify-center bg-slate-700 rounded text-xs hover:bg-red-600">-</button></div>
                            </div>
                         </div>
                         <button onClick={()=>{setScore({home:0, away:0}); setCurrentSet(s=>s+1); setEvents(prev => [...prev, {id: 'set-end', timestamp: currentTime, matchTimeFormatted:'', team:'Home', playerNumber:'', skill:'Freeball', startZone:1, endZone:1, result:'Continue', set: currentSet, tags:['Set End']} as TagEvent]);}} className="bg-slate-700 px-3 py-1 rounded text-xs font-bold hover:bg-slate-600">下一局</button>
                    </div>

                    {/* Horizontal Court View Roster ... */}
                    <div className="h-72 flex bg-orange-50 shrink-0 border-b border-slate-300 relative select-none overflow-hidden">
                        {/* HOME (LEFT) */}
                        <div className="flex-1 flex flex-col border-r-4 border-slate-400/50 relative">
                           <div className="flex-1 flex w-full relative">
                              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-7xl font-black text-blue-900 select-none z-0 overflow-hidden">
                                  {metadata.homeTeam.name}
                              </div>
                              <div className="flex-1 flex flex-col border-r-2 border-dashed border-white/60 bg-blue-50/30">
                                  {[5, 6, 1].map(z => {
                                      const p = lineup.home[z as Zone];
                                      const isSelected = p && pendingEvent.playerNumber === p.number && pendingEvent.team === 'Home';
                                      const isLibero = p?.role === 'L';
                                      return (
                                          <button key={z} onClick={()=>p && handleSelectPlayer('Home', p)} className={`flex-1 w-full border-b border-white/50 last:border-b-0 flex flex-col items-center justify-center px-2 transition-all z-10 ${isSelected ? '!bg-slate-800 !text-white' : isLibero ? 'bg-yellow-300 hover:bg-yellow-400' : 'hover:bg-blue-100 active:bg-blue-200'}`}>
                                              {p ? (<><span className={`text-5xl font-black leading-none mb-1 ${isSelected ? 'text-white' : isLibero ? 'text-blue-900' : 'text-blue-800'}`}>{p.number}</span><span className={`text-sm font-bold tracking-tight ${isSelected?'text-slate-300': isLibero ? 'text-blue-900/70' : 'text-slate-600'}`}>{getRoleName(p.role)}</span></>) : <span className="text-xs text-slate-300 mx-auto">{z}</span>}
                                          </button>
                                      )
                                  })}
                              </div>
                              <div className="flex-1 flex flex-col bg-blue-100/20">
                                  {[4, 3, 2].map(z => {
                                      const p = lineup.home[z as Zone];
                                      const isSelected = p && pendingEvent.playerNumber === p.number && pendingEvent.team === 'Home';
                                      const isLibero = p?.role === 'L';
                                      return (
                                          <button key={z} onClick={()=>p && handleSelectPlayer('Home', p)} className={`flex-1 w-full border-b border-white/50 last:border-b-0 flex flex-col items-center justify-center px-2 transition-all z-10 ${isSelected ? '!bg-slate-800 !text-white' : isLibero ? 'bg-yellow-300 hover:bg-yellow-400' : 'hover:bg-blue-100 active:bg-blue-200'}`}>
                                              {p ? (<><span className={`text-5xl font-black leading-none mb-1 ${isSelected ? 'text-white' : isLibero ? 'text-blue-900' : 'text-blue-800'}`}>{p.number}</span><span className={`text-sm font-bold tracking-tight ${isSelected?'text-slate-300': isLibero ? 'text-blue-900/70' : 'text-slate-600'}`}>{getRoleName(p.role)}</span></>) : <span className="text-xs text-slate-300 mx-auto">{z}</span>}
                                          </button>
                                      )
                                  })}
                              </div>
                           </div>
                           <div className="h-10 bg-slate-100 border-t border-slate-200 flex items-center justify-between px-2 gap-2 z-20">
                                <div className="flex gap-2">
                                    <button onClick={()=>handleRotate('Home')} className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-teal-500 shadow-sm"><RotateCcw size={14}/> 輪轉</button>
                                    <button onClick={() => { setPendingEvent({ team: 'Home', playerNumber: 'Team', timestamp: currentTime, tags: [] }); }} className={`px-3 py-1 bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-indigo-400 shadow-sm ${pendingEvent.playerNumber === 'Team' && pendingEvent.team === 'Home' ? 'ring-2 ring-slate-800' : ''}`} title="記錄全體事件 (如輪轉錯誤)"><Users size={14}/> 全體</button>
                                    <button onClick={()=>{setSubTeam('Home'); setShowSubModal(true)}} className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-orange-500 shadow-sm"><Users size={14}/> 換人</button>
                                </div>
                                {lineup.home.L ? (<button onClick={()=>handleSelectPlayer('Home', lineup.home.L!)} className={`px-3 py-1 bg-yellow-400 text-blue-900 rounded text-xs font-black border border-yellow-500 shadow-sm flex items-center gap-1 ${pendingEvent.playerNumber === lineup.home.L.number && pendingEvent.team === 'Home' ? 'ring-2 ring-slate-800' : ''}`}><span className="bg-white/50 px-1 rounded text-[10px]">L</span> {lineup.home.L.number}</button>) : <div/>}
                           </div>
                        </div>
                        <div className="w-2 bg-slate-800 z-30 shadow-xl flex items-center justify-center relative"><span className="absolute top-1/2 -translate-x-1/2 -rotate-90 text-[10px] text-white font-bold tracking-[0.5em] whitespace-nowrap bg-slate-800 py-2">NET</span></div>
                        {/* AWAY (RIGHT) */}
                        <div className="flex-1 flex flex-col relative">
                           <div className="flex-1 flex w-full relative">
                              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-7xl font-black text-red-900 select-none z-0 overflow-hidden">
                                  {metadata.awayTeam.name}
                              </div>
                              <div className="flex-1 flex flex-col border-r-2 border-dashed border-white/60 bg-red-100/20">
                                  {[2, 3, 4].map(z => {
                                      const p = lineup.away[z as Zone];
                                      const isSelected = p && pendingEvent.playerNumber === p.number && pendingEvent.team === 'Away';
                                      const isLibero = p?.role === 'L';
                                      return (
                                          <button key={z} onClick={()=>p && handleSelectPlayer('Away', p)} className={`flex-1 w-full border-b border-white/50 last:border-b-0 flex flex-col items-center justify-center px-2 transition-all z-10 ${isSelected ? '!bg-slate-800 !text-white' : isLibero ? 'bg-yellow-300 hover:bg-yellow-400' : 'hover:bg-red-100 active:bg-red-200'}`}>
                                              {p ? (<><span className={`text-5xl font-black leading-none mb-1 ${isSelected ? 'text-white' : isLibero ? 'text-red-900' : 'text-red-800'}`}>{p.number}</span><span className={`text-sm font-bold tracking-tight ${isSelected?'text-slate-300': isLibero ? 'text-red-900/70' : 'text-slate-600'}`}>{getRoleName(p.role)}</span></>) : <span className="text-xs text-slate-300 mx-auto">{z}</span>}
                                          </button>
                                      )
                                  })}
                              </div>
                              <div className="flex-1 flex flex-col bg-red-50/30">
                                  {[1, 6, 5].map(z => {
                                      const p = lineup.away[z as Zone];
                                      const isSelected = p && pendingEvent.playerNumber === p.number && pendingEvent.team === 'Away';
                                      const isLibero = p?.role === 'L';
                                      return (
                                          <button key={z} onClick={()=>p && handleSelectPlayer('Away', p)} className={`flex-1 w-full border-b border-white/50 last:border-b-0 flex flex-col items-center justify-center px-2 transition-all z-10 ${isSelected ? '!bg-slate-800 !text-white' : isLibero ? 'bg-yellow-300 hover:bg-yellow-400' : 'hover:bg-red-100 active:bg-red-200'}`}>
                                              {p ? (<><span className={`text-5xl font-black leading-none mb-1 ${isSelected ? 'text-white' : isLibero ? 'text-red-900' : 'text-red-800'}`}>{p.number}</span><span className={`text-sm font-bold tracking-tight ${isSelected?'text-slate-300': isLibero ? 'text-red-900/70' : 'text-slate-600'}`}>{getRoleName(p.role)}</span></>) : <span className="text-xs text-slate-300 mx-auto">{z}</span>}
                                          </button>
                                      )
                                  })}
                              </div>
                           </div>
                           <div className="h-10 bg-slate-100 border-t border-slate-200 flex items-center justify-between px-2 gap-2 z-20">
                                {lineup.away.L ? (<button onClick={()=>handleSelectPlayer('Away', lineup.away.L!)} className={`px-3 py-1 bg-yellow-400 text-red-900 rounded text-xs font-black border border-yellow-500 shadow-sm flex items-center gap-1 ${pendingEvent.playerNumber === lineup.away.L.number && pendingEvent.team === 'Away' ? 'ring-2 ring-slate-800' : ''}`}><span className="bg-white/50 px-1 rounded text-[10px]">L</span> {lineup.away.L.number}</button>) : <div/>}
                                <div className="flex gap-2">
                                    <button onClick={()=>{setSubTeam('Away'); setShowSubModal(true)}} className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-orange-500 shadow-sm"><Users size={14}/> 換人</button>
                                    <button onClick={() => { setPendingEvent({ team: 'Away', playerNumber: 'Team', timestamp: currentTime, tags: [] }); }} className={`px-3 py-1 bg-indigo-500 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-indigo-400 shadow-sm ${pendingEvent.playerNumber === 'Team' && pendingEvent.team === 'Away' ? 'ring-2 ring-slate-800' : ''}`} title="記錄全體事件 (如輪轉錯誤)"><Users size={14}/> 全體</button>
                                    <button onClick={()=>handleRotate('Away')} className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-bold flex items-center gap-1 hover:bg-teal-500 shadow-sm"><RotateCcw size={14}/> 輪轉</button>
                                </div>
                           </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-black min-h-0 relative border-t border-slate-300">
                        <VideoPlayer onTimeUpdate={(t) => setCurrentTime(t)} videoRef={videoRef} />
                    </div>
                </div>

                {/* RIGHT (50%): Skills + Map + Result Buttons */}
                <div className="w-1/2 flex border-l border-slate-300 bg-white h-full">
                    {/* Skills Column */}
                    <div className="w-64 p-3 bg-white flex flex-col gap-1 overflow-y-auto border-r border-slate-200 shadow-sm shrink-0">
                        <h4 className="text-xs font-bold text-slate-400 uppercase">動作 (Skill)</h4>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {SKILLS.filter(s => ['Serve', 'Receive', 'Set', 'Attack'].includes(s.id)).map(s => (
                                <button key={s.id} onClick={()=>handleSelectSkill(s.id)} className={`aspect-square font-black rounded-lg shadow-md text-3xl ${pendingEvent.skill === s.id ? 'ring-4 ring-offset-1 ring-blue-500 brightness-110' : 'opacity-90'} ${s.color} text-white flex items-center justify-center`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-1 mb-2">
                            {SKILLS.filter(s => !['Serve', 'Receive', 'Set', 'Attack'].includes(s.id)).map(s => (
                                <button key={s.id} onClick={()=>handleSelectSkill(s.id)} className={`h-11 font-bold rounded shadow-sm text-lg ${pendingEvent.skill === s.id ? 'ring-4 ring-offset-1 ring-blue-500 brightness-110' : 'opacity-90'} ${s.color} text-white`}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        
                        {(pendingEvent.skill === 'Attack' || pendingEvent.skill === 'Serve' || pendingEvent.skill === 'Fault' || pendingEvent.skill === 'Set') && (
                            <>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mt-1">細項 (Type)</h4>
                                <div className="grid grid-cols-2 gap-1">
                                    {(pendingEvent.skill === 'Attack' ? ATTACK_SUBTYPES : 
                                      pendingEvent.skill === 'Serve' ? SERVE_SUBTYPES : 
                                      pendingEvent.skill === 'Set' ? SET_SUBTYPES : 
                                      FAULT_SUBTYPES).map(t => (
                                        <button key={t.id} onClick={()=>setPendingEvent(p=>({...p, subType: t.id}))} className={`h-11 font-black rounded shadow-sm text-lg text-white ${t.color} ${pendingEvent.subType===t.id ? 'ring-4 ring-offset-1 ring-slate-800' : 'opacity-90'}`}>{t.label}</button>
                                    ))}
                                </div>
                            </>
                        )}
                        
                        <h4 className="text-xs font-bold text-slate-400 uppercase mt-1">品質 (Grade)</h4>
                        <div className="grid grid-cols-2 gap-1">
                            {GRADES.map(g => (
                                <button key={g.id} onClick={()=>setPendingEvent(p => ({...p, grade: g.id}))} className={`h-11 border-2 rounded shadow-sm font-bold flex items-center justify-center gap-2 ${pendingEvent.grade===g.id ? 'ring-4 ring-offset-1 ring-blue-500 bg-slate-50' : 'opacity-90 bg-white'}`}>
                                    <span className={`text-xl font-black ${g.color.split(' ')[1]}`}>{g.id}</span>
                                    <span className="text-xl text-slate-500">{g.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Trajectory Map & Results */}
                    <div className="flex-1 bg-slate-100 p-4 flex flex-col min-h-0">
                        <div className="flex-1 w-full bg-white border-4 border-slate-300 rounded-xl shadow-inner overflow-hidden flex flex-col mb-4">
                             <div className="bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 text-center border-b shrink-0">軌跡/落點 (Trajectory/End Zone) - 點擊決定</div>
                             <div className="flex-1 relative">
                                <CourtMap 
                                    label="" 
                                    trajectoryMode={true}
                                    pendingTrajectory={pendingEvent.startCoordinate && pendingEvent.endCoordinate ? { start: pendingEvent.startCoordinate, end: pendingEvent.endCoordinate } : undefined}
                                    startPoint={pendingEvent.startCoordinate}
                                    netPosition="center"
                                    topWatermark={metadata.awayTeam.name}
                                    bottomWatermark={metadata.homeTeam.name}
                                    onCoordinateSelect={(c) => {
                                        // Standard logic: If start exists, click sets end. 
                                        if (pendingEvent.startCoordinate) {
                                            const sz = getFullCourtZone(pendingEvent.startCoordinate);
                                            const ez = getFullCourtZone(c);
                                            // Auto-detect OUT if clicking outside margin
                                            const isOut = isOutOfBounds(c);
                                            let autoResult = pendingEvent.result;
                                            if (isOut && (pendingEvent.skill === 'Attack' || pendingEvent.skill === 'Serve')) {
                                                autoResult = 'Error';
                                            }
                                            setPendingEvent(p => ({ 
                                                ...p, 
                                                startZone: sz, 
                                                endZone: ez, 
                                                endCoordinate: c,
                                                result: autoResult 
                                            }));
                                        }
                                    }}
                                    onTrajectorySelect={(start, end) => {
                                        // This is triggered by CourtMap when start point + floor click occurs
                                        const sz = getFullCourtZone(start);
                                        const ez = getFullCourtZone(end);
                                        
                                        const isOut = isOutOfBounds(end);
                                        let autoResult = pendingEvent.result;
                                        if (isOut && (pendingEvent.skill === 'Attack' || pendingEvent.skill === 'Serve')) {
                                            autoResult = 'Error';
                                        }

                                        setPendingEvent(p => ({ 
                                            ...p, 
                                            startZone: sz, 
                                            endZone: ez, 
                                            startCoordinate: start, 
                                            endCoordinate: end, 
                                            result: autoResult
                                        }));
                                    }}
                                    // Allow dragging the start point at any time
                                    onStartPointChange={(newStart) => {
                                        setPendingEvent(p => ({ ...p, startCoordinate: newStart }));
                                    }}
                                    // Allow dragging the end point at any time
                                    onEndPointChange={(newEnd) => {
                                        setPendingEvent(p => ({ ...p, endCoordinate: newEnd }));
                                    }}
                                />
                             </div>
                        </div>

                        {/* Result Buttons */}
                        <div className="flex gap-2 h-20 shrink-0">
                            <button 
                                onClick={()=>commitEvent('Point')} 
                                className={`flex-1 font-black rounded-xl text-3xl shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all ${pendingEvent.result === 'Point' ? 'bg-green-600 text-white border-green-800 ring-4 ring-green-300' : 'bg-green-600 text-white hover:bg-green-500 border-green-800'}`}
                            >
                                得分
                            </button>
                            <button 
                                onClick={()=>commitEvent('Error')} 
                                className={`flex-1 font-black rounded-xl text-3xl shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all ${pendingEvent.result === 'Error' ? 'bg-red-600 text-white border-red-800 ring-4 ring-red-300 scale-105' : 'bg-red-600 text-white hover:bg-red-500 border-red-800'}`}
                            >
                                失誤
                            </button>
                            <button 
                                onClick={()=>commitEvent('Continue')} 
                                className={`flex-1 font-bold rounded-xl text-2xl shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all ${pendingEvent.result === 'Continue' ? 'bg-slate-200 text-slate-800 border-slate-400 ring-4 ring-slate-300' : 'bg-slate-200 text-slate-600 hover:bg-slate-300 border-slate-400'}`}
                            >
                                繼續
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
            alert("登入失敗，請確認您的網路連線或稍後再試。");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const reset = () => {
        localStorage.removeItem(STORAGE_KEY);
        setKey(k => k + 1);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center animate-fade-in-up">
                    <div className="flex justify-center mb-6">
                        <div className="bg-slate-700 p-4 rounded-full">
                            <Activity size={48} className="text-blue-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black mb-2 tracking-tight">VolleyTag Pro</h1>
                    <p className="text-slate-400 mb-8 font-medium">專業排球數據記錄與分析系統</p>
                    
                    <button 
                        onClick={handleLogin} 
                        disabled={isLoggingIn}
                        className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20'}`}
                    >
                        {isLoggingIn ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        ) : (
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {isLoggingIn ? '登入中...' : '使用 Google 帳號登入'}
                    </button>
                    
                    <p className="mt-6 text-xs text-slate-500">
                        登入即代表您同意本系統的使用條款與隱私權政策。
                        <br/>僅限教練與球隊管理員使用。
                    </p>
                </div>
            </div>
        );
    }

    return <VolleyTagApp key={key} onResetApp={reset} user={user} onLogout={handleLogout} />;
};

export default App;