import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Calendar, Trophy, BarChart3, Plus, Check, X, Clock,
  AlertCircle, UserPlus, Activity, Shield, Search, Filter,
  ChevronRight, Award, Trash2, Edit, RotateCcw, Target,
  FileText, UserCheck, Zap, TrendingUp, MapPin, CheckCircle2,
  XCircle, HelpCircle, Clock3, Dumbbell, ChevronLeft, LayoutList, CalendarDays,
  Smartphone, ArrowLeft, History
} from 'lucide-react';
import { db } from './firebase'; // Make sure your firebase.js is properly configured and exported
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const INITIAL_PLAYERS = [];
const INITIAL_SCHEDULE = [];

// Helper: Convert 24h time ("16:00") to 12h format ("4:00 PM")
const formatTimeTo12Hour = (time24) => {
  if (!time24) return '';
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutesStr || '00'} ${ampm}`;
};

// Helper: Get start of current week (Monday)
const getStartOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardLevelFilter, setDashboardLevelFilter] = useState('Varsity'); // 'Varsity' | 'JV' | 'All'
  
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [loadingData, setLoadingData] = useState(true);

  const [editingPlayer, setEditingPlayer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState('All');
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Stat Sheet Modal State
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [activeMatchForStats, setActiveMatchForStats] = useState(null);
  const [matchStats, setMatchStats] = useState({});

  // LIVE MATCHDAY TRACKER STATE
  const [showLiveTracker, setShowLiveTracker] = useState(false);
  const [activeLiveMatch, setActiveLiveMatch] = useState(null);
  const [selectedPlayerForTracker, setSelectedPlayerForTracker] = useState(null);
  const [selectedActionForTracker, setSelectedActionForTracker] = useState(null);
  const [liveLog, setLiveLog] = useState([]);

  // Practice Attendance Sheet Modal State
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [activeEventForAttendance, setActiveEventForAttendance] = useState(null);
  const [sessionAttendance, setSessionAttendance] = useState({});

  // Schedule view mode: 'list' | 'week' | 'month'
  const [scheduleViewMode, setScheduleViewMode] = useState('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'Forward', grade: 'Freshman', level: 'Varsity', notes: '' });
  const [newEvent, setNewEvent] = useState({
    type: 'Match',
    level: 'Varsity',
    title: '',
    date: '',
    time: '16:00',
    location: '',
    status: 'Upcoming',
    result: '',
    goalsFor: '',
    goalsAgainst: '',
    notes: '',
    stats: {},
    attendance: {}
  });

  // Real-time synchronization with Firestore using onSnapshot
  useEffect(() => {
    const docRef = doc(db, 'north_soccer_team', 'main_data');
    
    // Initial fetch check using getDoc (demonstrating explicit getDoc usage alongside onSnapshot)
    getDoc(docRef).then((docSnap) => {
      if (!docSnap.exists()) {
        // Initialize document if it doesn't exist yet
        setDoc(docRef, { players: INITIAL_PLAYERS, schedule: INITIAL_SCHEDULE });
      }
    }).catchall?.((err) => console.error("Error checking document:", err));

    // Real-time listener using onSnapshot
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.players) setPlayers(data.players);
        if (data.schedule) setSchedule(data.schedule);
      }
      setLoadingData(false);
    }, (error) => {
      console.error("Error fetching real-time data: ", error);
      setLoadingData(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper function to commit updated players and schedule to Firestore using setDoc
  const saveToFirestore = async (updatedPlayers, updatedSchedule) => {
    try {
      const docRef = doc(db, 'north_soccer_team', 'main_data');
      await setDoc(docRef, {
        players: updatedPlayers,
        schedule: updatedSchedule
      }, { merge: true });
    } catch (error) {
      console.error("Error saving data to Firestore: ", error);
    }
  };

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.number.toString().includes(searchQuery);
      const matchesPos = filterPosition === 'All' || p.position === filterPosition;
      return matchesSearch && matchesPos;
    });
  }, [players, searchQuery, filterPosition]);

  // Stat Sheet Eligible Players
  const eligibleMatchPlayers = useMemo(() => {
    if (!activeMatchForStats && !activeLiveMatch) return [];
    const matchLevel = (activeMatchForStats || activeLiveMatch)?.level || 'Varsity';

    return players
      .filter(player => {
        const playerLevel = player.level || 'Varsity';
        if (playerLevel === 'Swing') return true;
        if (matchLevel === 'Varsity') return playerLevel === 'Varsity';
        if (matchLevel === 'JV') return playerLevel === 'JV';
        return true;
      })
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
  }, [players, activeMatchForStats, activeLiveMatch]);

  // All players for Practice Attendance sorted by Jersey Number
  const practiceAttendancePlayers = useMemo(() => {
    return [...players].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
  }, [players]);

  // Separate metrics for Varsity and JV matches
  const teamMetrics = useMemo(() => {
    const calcMetrics = (levelFilter) => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let totalGoalsFor = 0;
      let totalGoalsAgainst = 0;
      let assists = 0;
      let shots = 0;
      let saves = 0;

      schedule.forEach(event => {
        if (event.type === 'Match') {
          const mLevel = event.level || 'Varsity';
          if (levelFilter !== 'All' && mLevel !== levelFilter) return;

          if (event.result === 'Win') wins += 1;
          if (event.result === 'Loss') losses += 1;
          if (event.result === 'Draw') draws += 1;

          if (event.goalsFor !== undefined && event.goalsFor !== '') {
            totalGoalsFor += Number(event.goalsFor || 0);
          }
          if (event.goalsAgainst !== undefined && event.goalsAgainst !== '') {
            totalGoalsAgainst += Number(event.goalsAgainst || 0);
          }

          if (event.stats) {
            Object.values(event.stats).forEach(pStat => {
              assists += Number(pStat.assists || 0);
              shots += Number(pStat.shots || 0);
              saves += Number(pStat.saves || 0);
            });
          }
        }
      });

      return {
        wins,
        losses,
        draws,
        totalGoalsFor,
        totalGoalsAgainst,
        goalDifference: totalGoalsFor - totalGoalsAgainst,
        assists,
        shots,
        saves,
        matchesCount: wins + losses + draws
      };
    };

    return {
      varsity: calcMetrics('Varsity'),
      jv: calcMetrics('JV'),
      combined: calcMetrics('All'),
    };
  }, [schedule]);

  const activeMetrics = useMemo(() => {
    if (dashboardLevelFilter === 'Varsity') return teamMetrics.varsity;
    if (dashboardLevelFilter === 'JV') return teamMetrics.jv;
    return teamMetrics.combined;
  }, [teamMetrics, dashboardLevelFilter]);

  // Separate events into Upcoming and Previous
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = [];
    const past = [];

    schedule.forEach(item => {
      if (item.status === 'Completed' || (item.date && item.date < today)) {
        past.push(item);
      } else {
        upcoming.push(item);
      }
    });

    return {
      upcomingEvents: upcoming.sort((a, b) => (a.date > b.date ? 1 : -1)),
      pastEvents: past.sort((a, b) => (a.date < b.date ? 1 : -1))
    };
  }, [schedule]);

  // Events occurring this current week
  const thisWeekEvents = useMemo(() => {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return schedule.filter(item => {
      if (!item.date) return false;
      const eventDate = new Date(item.date + 'T00:00:00');
      return eventDate >= startOfWeek && eventDate <= endOfWeek;
    }).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [schedule]);

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];
    const startingDayOfWeek = firstDay.getDay();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, dateStr: null, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr, isCurrentMonth: true });
    }

    return days;
  }, [calendarMonth]);

  const handleOpenAddPlayerModal = () => {
    setEditingPlayer(null);
    setNewPlayer({ name: '', number: '', position: 'Forward', grade: 'Freshman', level: 'Varsity', notes: '' });
    setShowPlayerModal(true);
  };

  const handleEditPlayerClick = (player) => {
    setEditingPlayer(player);
    setNewPlayer({
      name: player.name,
      number: player.number,
      position: player.position,
      grade: player.grade || 'Freshman',
      level: player.level || 'Varsity',
      notes: player.notes || ''
    });
    setShowPlayerModal(true);
  };

  const handleSavePlayer = (e) => {
    e.preventDefault();
    if (!newPlayer.name) return;

    let updatedPlayers;
    if (editingPlayer) {
      updatedPlayers = players.map(p => p.id === editingPlayer.id ? { ...newPlayer, id: p.id, number: Number(newPlayer.number) || 0 } : p);
    } else {
      const playerObj = { ...newPlayer, id: 'p_' + Date.now(), number: Number(newPlayer.number) || 0 };
      updatedPlayers = [...players, playerObj];
    }

    setPlayers(updatedPlayers);
    saveToFirestore(updatedPlayers, schedule);

    setNewPlayer({ name: '', number: '', position: 'Forward', grade: 'Freshman', level: 'Varsity', notes: '' });
    setEditingPlayer(null);
    setShowPlayerModal(false);
  };

  const handleDeletePlayer = (playerId) => {
    if (window.confirm('Are you sure you want to remove this player?')) {
      const updatedPlayers = players.filter(p => p.id !== playerId);
      setPlayers(updatedPlayers);
      saveToFirestore(updatedPlayers, schedule);
    }
  };

  const handleOpenAddEventModal = (type = 'Match', status = 'Upcoming') => {
    setEditingEvent(null);
    setNewEvent({
      type,
      level: 'Varsity',
      title: '',
      date: new Date().toISOString().split('T')[0],
      time: '16:00',
      location: '',
      status,
      result: '',
      goalsFor: '',
      goalsAgainst: '',
      notes: '',
      stats: {},
      attendance: {}
    });
    setShowEventModal(true);
  };

  const handleEditEventClick = (eventItem) => {
    setEditingEvent(eventItem);
    setNewEvent({
      level: 'Varsity',
      result: '',
      goalsFor: '',
      goalsAgainst: '',
      ...eventItem
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title && !newEvent.date) return;

    let updatedSchedule;
    if (editingEvent) {
      updatedSchedule = schedule.map(item => item.id === editingEvent.id ? { ...newEvent, id: item.id } : item);
    } else {
      const eventObj = { ...newEvent, id: 'e_' + Date.now() };
      updatedSchedule = [eventObj, ...schedule];
    }

    setSchedule(updatedSchedule);
    saveToFirestore(players, updatedSchedule);

    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      const updatedSchedule = schedule.filter(item => item.id !== eventId);
      setSchedule(updatedSchedule);
      saveToFirestore(players, updatedSchedule);
    }
  };

  // Open Stat Sheet Modal
  const handleOpenStatsModal = (matchEvent) => {
    setActiveMatchForStats(matchEvent);
    setMatchStats(matchEvent.stats || {});
    setShowStatsModal(true);
  };

  const handleStatChange = (playerId, field, value) => {
    setMatchStats(prev => {
      const current = prev[playerId] || { played: false, shots: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 0 };
      let updatedValue = value;
      if (field !== 'played') {
        updatedValue = Math.max(0, parseInt(value, 10) || 0);
      }
      return {
        ...prev,
        [playerId]: {
          ...current,
          [field]: updatedValue,
          played: field === 'played' ? updatedValue : (updatedValue > 0 ? true : current.played)
        }
      };
    });
  };

  const handleSaveStats = () => {
    if (!activeMatchForStats) return;

    const updatedSchedule = schedule.map(item => {
      if (item.id === activeMatchForStats.id) {
        return { ...item, stats: matchStats };
      }
      return item;
    });

    setSchedule(updatedSchedule);
    saveToFirestore(players, updatedSchedule);

    setShowStatsModal(false);
    setActiveMatchForStats(null);
  };

  // Open LIVE MATCH TRACKER
  const handleOpenLiveTracker = (matchEvent) => {
    setActiveLiveMatch(matchEvent);
    setSelectedPlayerForTracker(null);
    setSelectedActionForTracker(null);
    setLiveLog([]);
    setShowLiveTracker(true);
  };

  // Record a player stat action in Live Matchday Tracker
  const handleApplyLiveStat = (playerObj, actionKey) => {
    if (!activeLiveMatch || !playerObj || !actionKey) return;

    const fieldMap = {
      Shot: 'shots',
      Goal: 'goals',
      Assist: 'assists',
      'Yellow Card': 'yellowCards',
      'Red Card': 'redCards',
      Save: 'saves'
    };

    const targetField = fieldMap[actionKey];
    if (!targetField) return;

    const currentStats = activeLiveMatch.stats || {};
    const pStat = currentStats[playerObj.id] || { played: true, shots: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 0 };
    const currentVal = Number(pStat[targetField] || 0);

    const updatedMatchStats = {
      ...currentStats,
      [playerObj.id]: {
        ...pStat,
        played: true,
        [targetField]: currentVal + 1
      }
    };

    // Automatically adjust score if action is 'Goal'
    let updatedGoalsFor = activeLiveMatch.goalsFor;
    if (actionKey === 'Goal') {
      updatedGoalsFor = (Number(activeLiveMatch.goalsFor || 0) + 1).toString();
    }

    const updatedMatch = {
      ...activeLiveMatch,
      goalsFor: updatedGoalsFor,
      stats: updatedMatchStats
    };

    setActiveLiveMatch(updatedMatch);
    const updatedSchedule = schedule.map(item => item.id === updatedMatch.id ? updatedMatch : item);
    setSchedule(updatedSchedule);
    saveToFirestore(players, updatedSchedule);

    // Log the event
    const logEntry = {
      id: 'log_' + Date.now(),
      isOpponent: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      playerId: playerObj.id,
      playerName: playerObj.name,
      playerNumber: playerObj.number,
      action: actionKey,
      field: targetField
    };

    setLiveLog(prev => [logEntry, ...prev]);

    // Clear selections
    setSelectedPlayerForTracker(null);
    setSelectedActionForTracker(null);
  };

  // Record Opponent Stat (Goal or Shot)
  const handleApplyOpponentStat = (actionKey) => {
    if (!activeLiveMatch) return;

    let updatedGoalsAgainst = activeLiveMatch.goalsAgainst || '0';
    if (actionKey === 'Opp. Goal') {
      updatedGoalsAgainst = (Number(activeLiveMatch.goalsAgainst || 0) + 1).toString();
    }

    const updatedMatch = {
      ...activeLiveMatch,
      goalsAgainst: updatedGoalsAgainst
    };

    setActiveLiveMatch(updatedMatch);
    const updatedSchedule = schedule.map(item => item.id === updatedMatch.id ? updatedMatch : item);
    setSchedule(updatedSchedule);
    saveToFirestore(players, updatedSchedule);

    // Log the event
    const logEntry = {
      id: 'log_' + Date.now(),
      isOpponent: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      playerName: activeLiveMatch.title || 'Opponent',
      action: actionKey
    };

    setLiveLog(prev => [logEntry, ...prev]);

    // Clear selections
    setSelectedPlayerForTracker(null);
    setSelectedActionForTracker(null);
  };

  // Undo last action in Live Matchday Tracker
  const handleUndoLiveAction = () => {
    if (liveLog.length === 0 || !activeLiveMatch) return;

    const lastLog = liveLog[0];

    if (lastLog.isOpponent) {
      let updatedGoalsAgainst = activeLiveMatch.goalsAgainst;
      if (lastLog.action === 'Opp. Goal') {
        updatedGoalsAgainst = Math.max(0, Number(activeLiveMatch.goalsAgainst || 0) - 1).toString();
      }

      const updatedMatch = {
        ...activeLiveMatch,
        goalsAgainst: updatedGoalsAgainst
      };

      setActiveLiveMatch(updatedMatch);
      const updatedSchedule = schedule.map(item => item.id === updatedMatch.id ? updatedMatch : item);
      setSchedule(updatedSchedule);
      saveToFirestore(players, updatedSchedule);
      setLiveLog(prev => prev.slice(1));
      return;
    }

    const currentStats = activeLiveMatch.stats || {};
    const pStat = currentStats[lastLog.playerId];

    if (pStat && pStat[lastLog.field] > 0) {
      const updatedVal = Math.max(0, pStat[lastLog.field] - 1);
      const updatedMatchStats = {
        ...currentStats,
        [lastLog.playerId]: {
          ...pStat,
          [lastLog.field]: updatedVal
        }
      };

      let updatedGoalsFor = activeLiveMatch.goalsFor;
      if (lastLog.action === 'Goal') {
        updatedGoalsFor = Math.max(0, Number(activeLiveMatch.goalsFor || 0) - 1).toString();
      }

      const updatedMatch = {
        ...activeLiveMatch,
        goalsFor: updatedGoalsFor,
        stats: updatedMatchStats
      };

      setActiveLiveMatch(updatedMatch);
      const updatedSchedule = schedule.map(item => item.id === updatedMatch.id ? updatedMatch : item);
      setSchedule(updatedSchedule);
      saveToFirestore(players, updatedSchedule);
      setLiveLog(prev => prev.slice(1));
    }
  };

  // Open Attendance Sheet for Practice
  const handleOpenAttendanceModal = (eventItem) => {
    setActiveEventForAttendance(eventItem);
    setSessionAttendance(eventItem.attendance || {});
    setShowAttendanceModal(true);
  };

  const handleAttendanceChange = (playerId, status) => {
    setSessionAttendance(prev => ({
      ...prev,
      [playerId]: status
    }));
  };

  const handleSaveAttendance = () => {
    if (!activeEventForAttendance) return;

    const updatedSchedule = schedule.map(item => {
      if (item.id === activeEventForAttendance.id) {
        return { ...item, attendance: sessionAttendance };
      }
      return item;
    });

    setSchedule(updatedSchedule);
    saveToFirestore(players, updatedSchedule);

    setShowAttendanceModal(false);
    setActiveEventForAttendance(null);
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Loading North Soccer Data from Firebase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans pb-12 selection:bg-yellow-400 selection:text-zinc-950">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-400 text-zinc-950 rounded-xl font-black shadow-lg shadow-yellow-400/10">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white uppercase flex items-center gap-1.5">
              NORTH <span className="text-yellow-400">SOCCER</span>
            </h1>
            <p className="text-xs font-medium text-zinc-400">Squad & Matchday Operations</p>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <nav className="flex items-center gap-1 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800/80">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'roster', label: 'Roster', icon: Users },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'attendance', label: 'Practice Attendance', icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-yellow-400 text-zinc-950 shadow-md shadow-yellow-400/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Level Selector Toggle for Record & Goal Stats */}
            <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" /> Team Performance Overview
              </h2>
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
                {['Varsity', 'JV', 'All'].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setDashboardLevelFilter(lvl)}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      dashboardLevelFilter === lvl
                        ? 'bg-yellow-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lvl === 'All' ? 'Combined' : lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
                <div className="absolute right-3 top-3 p-3 bg-zinc-800 text-yellow-400 rounded-xl">
                  <Trophy className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {dashboardLevelFilter} Record
                </p>
                <h3 className="text-3xl font-black text-white mt-1">
                  {activeMetrics.wins}-{activeMetrics.losses}-{activeMetrics.draws}
                </h3>
                <span className="inline-block mt-2 text-xs text-yellow-400 bg-yellow-400/10 font-semibold px-2 py-0.5 rounded-md">
                  {activeMetrics.matchesCount} Match(es) Played
                </span>
              </div>

              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
                <div className="absolute right-3 top-3 p-3 bg-zinc-800 text-yellow-400 rounded-xl">
                  <Target className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {dashboardLevelFilter} Goals (GF/GA)
                </p>
                <h3 className="text-3xl font-black text-white mt-1">
                  {activeMetrics.totalGoalsFor} <span className="text-zinc-500 font-normal text-xl">/ {activeMetrics.totalGoalsAgainst}</span>
                </h3>
                <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-md ${
                  activeMetrics.goalDifference >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                }`}>
                  Goal Diff: {activeMetrics.goalDifference >= 0 ? `+${activeMetrics.goalDifference}` : activeMetrics.goalDifference}
                </span>
              </div>

              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
                <div className="absolute right-3 top-3 p-3 bg-zinc-800 text-yellow-400 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Squad</p>
                <h3 className="text-3xl font-black text-white mt-1">{players.length}</h3>
                <span className="inline-block mt-2 text-xs text-zinc-300 bg-zinc-800 font-semibold px-2 py-0.5 rounded-md">
                  Registered Roster
                </span>
              </div>

              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-colors">
                <div className="absolute right-3 top-3 p-3 bg-zinc-800 text-yellow-400 rounded-xl">
                  <Shield className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">GK Saves</p>
                <h3 className="text-3xl font-black text-white mt-1">{activeMetrics.saves}</h3>
                <span className="inline-block mt-2 text-xs text-yellow-400 bg-yellow-400/10 font-semibold px-2 py-0.5 rounded-md">
                  Recorded in Matches
                </span>
              </div>
            </div>

            {/* Dashboard Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upcoming Events Preview */}
              <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-yellow-400" /> Upcoming Schedule
                  </h2>
                  <button onClick={() => setActiveTab('schedule')} className="text-xs font-semibold text-yellow-400 hover:text-yellow-300">
                    View All
                  </button>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-950 border border-zinc-800/80 rounded-xl">
                    <p className="text-zinc-400 text-xs">No upcoming matches or practices scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              event.type === 'Match' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
                            }`}>
                              {event.type === 'Match' ? `${event.level || 'Varsity'} Match` : 'Training Practice'}
                            </span>
                            <span className="text-xs font-medium text-zinc-400">
                              {event.date} {event.time && `• ${formatTimeTo12Hour(event.time)}`}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">
                            {event.type === 'Match' ? `vs ${event.title}` : event.title}
                          </h4>
                          {event.location && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-zinc-400" /> {event.location}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {event.type === 'Match' && (
                            <button
                              onClick={() => handleOpenLiveTracker(event)}
                              className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black rounded-lg text-xs flex items-center gap-1 shadow-md shadow-yellow-400/10"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" /> Live Tracker
                            </button>
                          )}
                          <span className="text-xs font-semibold bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700">
                            {event.status || 'Upcoming'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Position Distribution */}
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-yellow-400" /> Position Breakdown
                  </h2>
                  <div className="space-y-3">
                    {['Forward', 'Midfielder', 'Defender', 'Goalkeeper'].map((pos) => {
                      const count = players.filter(p => p.position === pos).length;
                      const pct = players.length ? Math.round((count / players.length) * 100) : 0;
                      return (
                        <div key={pos} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-zinc-300">{pos}s</span>
                            <span className="text-yellow-400 font-bold">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                            <div className="bg-yellow-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button 
                  onClick={handleOpenAddPlayerModal}
                  className="w-full mt-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-yellow-400/10"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add New Player
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ROSTER TAB */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name or jersey number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <select
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-yellow-400"
                >
                  <option value="All">All Positions</option>
                  <option value="Forward">Forwards</option>
                  <option value="Midfielder">Midfielders</option>
                  <option value="Defender">Defenders</option>
                  <option value="Goalkeeper">Goalkeepers</option>
                </select>
              </div>

              <button
                onClick={handleOpenAddPlayerModal}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-yellow-400/10"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Add Player
              </button>
            </div>

            {/* Player Cards */}
            {filteredPlayers.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-white font-bold mb-1">No players in squad</h3>
                <p className="text-zinc-500 text-xs mb-4">Add players to North Soccer to begin tracking your squad roster.</p>
                <button
                  onClick={handleOpenAddPlayerModal}
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add First Player
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map((player) => {
                  let pGoals = 0, pAssists = 0, pShots = 0, pYellows = 0, pReds = 0, pSaves = 0, pMatchesPlayed = 0;
                  
                  schedule.forEach(e => {
                    if (e.type === 'Match' && e.stats?.[player.id]) {
                      const pStat = e.stats[player.id];
                      if (pStat.played) pMatchesPlayed += 1;
                      pGoals += Number(pStat.goals || 0);
                      pAssists += Number(pStat.assists || 0);
                      pShots += Number(pStat.shots || 0);
                      pYellows += Number(pStat.yellowCards || 0);
                      pReds += Number(pStat.redCards || 0);
                      pSaves += Number(pStat.saves || 0);
                    }
                  });

                  return (
                    <div key={player.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 relative group hover:border-zinc-700 transition-colors space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-yellow-400 text-lg">
                            #{player.number}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-sm">{player.name}</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                                {player.position}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                player.level === 'Varsity'
                                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                                  : player.level === 'JV'
                                  ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                                  : 'bg-purple-400/10 text-purple-400 border border-purple-400/20'
                              }`}>
                                {player.level || 'Varsity'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditPlayerClick(player)}
                            className="p-1.5 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Edit Player"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Delete Player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Matches Played Counter */}
                      <div className="bg-zinc-950 border border-zinc-800/80 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-zinc-400 font-medium">Matches Played:</span>
                        <span className="font-black text-yellow-400 text-sm">{pMatchesPlayed}</span>
                      </div>

                      {/* Cumulative Season Stats Badge Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80 text-center text-xs">
                        <div>
                          <div className="text-zinc-500 text-[10px] uppercase font-bold">Goals</div>
                          <div className="font-black text-yellow-400 text-sm">{pGoals}</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 text-[10px] uppercase font-bold">Assists</div>
                          <div className="font-black text-white text-sm">{pAssists}</div>
                        </div>
                        <div>
                          <div className="text-zinc-500 text-[10px] uppercase font-bold">Shots</div>
                          <div className="font-black text-white text-sm">{pShots}</div>
                        </div>
                        {player.position === 'Goalkeeper' ? (
                          <div className="col-span-3 pt-1 border-t border-zinc-800/60 flex justify-around items-center">
                            <span className="text-zinc-400 text-[10px] font-bold uppercase">Saves: {pSaves}</span>
                            <span className="text-zinc-400 text-[10px] font-bold uppercase">Cards: Y{pYellows} / R{pReds}</span>
                          </div>
                        ) : (
                          <div className="col-span-3 pt-1 border-t border-zinc-800/60 text-zinc-400 text-[10px] font-bold uppercase">
                            Cards: Y{pYellows} / R{pReds}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 space-y-1 text-xs text-zinc-400">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Grade:</span>
                          <span className="text-zinc-200 font-medium">{player.grade}</span>
                        </div>
                        {player.notes && (
                          <p className="text-zinc-400 italic bg-zinc-950 p-2 rounded-lg border border-zinc-800/50 mt-1">
                            "{player.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">Matches & Practice Schedule</h2>
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setScheduleViewMode('list')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      scheduleViewMode === 'list'
                        ? 'bg-yellow-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" /> List
                  </button>
                  <button
                    onClick={() => setScheduleViewMode('week')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      scheduleViewMode === 'week'
                        ? 'bg-yellow-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Clock3 className="w-3.5 h-3.5" /> This Week
                  </button>
                  <button
                    onClick={() => setScheduleViewMode('month')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      scheduleViewMode === 'month'
                        ? 'bg-yellow-400 text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" /> Month
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenAddEventModal('Practice', 'Upcoming')}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-zinc-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Practice
                </button>
                <button
                  onClick={() => handleOpenAddEventModal('Match', 'Upcoming')}
                  className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-yellow-400/10"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add Match
                </button>
              </div>
            </div>

            {/* LIST VIEW */}
            {scheduleViewMode === 'list' && (
              <div className="space-y-8">
                {/* Upcoming Events */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Upcoming Events ({upcomingEvents.length})
                  </h3>

                  {upcomingEvents.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 text-center text-xs text-zinc-500">
                      No upcoming matches or practices scheduled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                event.type === 'Match' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
                              }`}>
                                {event.type === 'Match' ? `${event.level || 'Varsity'} Match` : 'Training Practice'}
                              </span>
                              <span className="text-xs font-medium text-zinc-400">
                                {event.date} {event.time && `at ${formatTimeTo12Hour(event.time)}`}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-white">
                              {event.type === 'Match' ? `vs ${event.title}` : event.title}
                            </h4>
                            {event.location && (
                              <p className="text-xs text-zinc-400 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {event.location}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {event.type === 'Match' && (
                              <button
                                onClick={() => handleOpenLiveTracker(event)}
                                className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-black rounded-lg text-xs flex items-center gap-1 shadow-md shadow-yellow-400/10"
                              >
                                <Zap className="w-3.5 h-3.5 fill-current" /> Live Tracker
                              </button>
                            )}

                            {event.type === 'Practice' && (
                              <button
                                onClick={() => handleOpenAttendanceModal(event)}
                                className="p-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400 hover:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Attendance
                              </button>
                            )}

                            {event.type === 'Match' && (
                              <button
                                onClick={() => handleOpenStatsModal(event)}
                                className="p-2 text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 hover:bg-yellow-400 hover:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <BarChart3 className="w-3.5 h-3.5" /> Stat Sheet
                              </button>
                            )}

                            <button
                              onClick={() => handleEditEventClick(event)}
                              className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 bg-zinc-950 border border-zinc-800 rounded-lg text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Previous Events & Results */}
                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Previous Events ({pastEvents.length})
                  </h3>

                  {pastEvents.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-6 text-center text-xs text-zinc-500">
                      No previous events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pastEvents.map((event) => (
                        <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                event.type === 'Match' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
                              }`}>
                                {event.type === 'Match' ? `${event.level || 'Varsity'} Match` : 'Training Practice'}
                              </span>
                              <span className="text-xs font-medium text-zinc-400">{event.date}</span>
                            </div>
                            <h4 className="text-base font-bold text-white">
                              {event.type === 'Match' ? `vs ${event.title}` : event.title}
                            </h4>
                            {event.notes && (
                              <p className="text-xs text-zinc-400 italic mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800/50">
                                "{event.notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {event.type === 'Match' && (event.result || event.goalsFor !== '') && (
                              <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold">
                                <span className="text-[10px] text-zinc-500 uppercase font-black">
                                  [{event.level || 'Varsity'}]
                                </span>
                                {event.result && (
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                                    event.result === 'Win'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : event.result === 'Loss'
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                                  }`}>
                                    {event.result}
                                  </span>
                                )}
                                {(event.goalsFor !== '' || event.goalsAgainst !== '') && (
                                  <span className="text-white font-black">
                                    {event.goalsFor || 0} - {event.goalsAgainst || 0}
                                  </span>
                                )}
                              </div>
                            )}

                            {event.type === 'Match' && (
                              <button
                                onClick={() => handleOpenLiveTracker(event)}
                                className="px-3 py-1.5 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 hover:bg-yellow-400 hover:text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1"
                              >
                                <Zap className="w-3.5 h-3.5" /> Tracker
                              </button>
                            )}

                            {event.type === 'Practice' && (
                              <button
                                onClick={() => handleOpenAttendanceModal(event)}
                                className="p-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400 hover:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Attendance
                              </button>
                            )}
                            {event.type === 'Match' && (
                              <button
                                onClick={() => handleOpenStatsModal(event)}
                                className="p-2 text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                              >
                                <BarChart3 className="w-3.5 h-3.5" /> Stat Sheet
                              </button>
                            )}
                            <button
                              onClick={() => handleEditEventClick(event)}
                              className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* THIS WEEK VIEW */}
            {scheduleViewMode === 'week' && (
              <div className="space-y-4">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-yellow-400" /> Events This Week
                  </h3>
                  <span className="text-xs text-zinc-400 font-medium">{thisWeekEvents.length} session(s)</span>
                </div>

                {thisWeekEvents.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-12 text-center text-xs text-zinc-500">
                    No scheduled matches or practices for this week.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {thisWeekEvents.map((event) => (
                      <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              event.type === 'Match' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
                            }`}>
                              {event.type === 'Match' ? `${event.level || 'Varsity'} Match` : 'Training Practice'}
                            </span>
                            <span className="text-xs text-zinc-400 font-semibold">{event.date}</span>
                          </div>
                          <h4 className="text-base font-bold text-white">
                            {event.type === 'Match' ? `vs ${event.title}` : event.title}
                          </h4>
                          {event.time && (
                            <p className="text-xs text-zinc-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-500" /> {formatTimeTo12Hour(event.time)}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-xs text-zinc-400 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {event.location}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-zinc-800/80 flex justify-end gap-2">
                          {event.type === 'Match' && (
                            <button
                              onClick={() => handleOpenLiveTracker(event)}
                              className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" /> Live Tracker
                            </button>
                          )}
                          {event.type === 'Practice' && (
                            <button
                              onClick={() => handleOpenAttendanceModal(event)}
                              className="p-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400 hover:text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Attendance
                            </button>
                          )}
                          {event.type === 'Match' && (
                            <button
                              onClick={() => handleOpenStatsModal(event)}
                              className="p-2 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                              <BarChart3 className="w-3.5 h-3.5" /> Stat Sheet
                            </button>
                          )}
                          <button
                            onClick={() => handleEditEventClick(event)}
                            className="p-2 text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg text-xs flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MONTHLY VIEW */}
            {scheduleViewMode === 'month' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-2.5 py-1 text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 font-semibold rounded-lg"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-zinc-500 border-b border-zinc-800 pb-2">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    const cellEvents = cell.dateStr ? schedule.filter(e => e.date === cell.dateStr) : [];
                    const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

                    return (
                      <div
                        key={idx}
                        className={`min-h-[90px] p-1.5 rounded-xl border ${
                          cell.isCurrentMonth
                            ? isToday
                              ? 'bg-zinc-950 border-yellow-400'
                              : 'bg-zinc-950/60 border-zinc-800/80'
                            : 'bg-zinc-950/20 border-transparent text-zinc-700'
                        }`}
                      >
                        <div className={`text-xs font-bold ${cell.isCurrentMonth ? (isToday ? 'text-yellow-400' : 'text-zinc-300') : 'text-zinc-700'}`}>
                          {cell.day}
                        </div>

                        {cell.isCurrentMonth && cellEvents.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {cellEvents.map(e => (
                              <button
                                key={e.id}
                                onClick={() => e.type === 'Match' ? handleOpenLiveTracker(e) : handleOpenAttendanceModal(e)}
                                className={`w-full text-left p-1 rounded text-[10px] truncate block font-semibold ${
                                  e.type === 'Match'
                                    ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30'
                                    : 'bg-blue-400/20 text-blue-300 border border-blue-400/30'
                                }`}
                              >
                                {e.time ? formatTimeTo12Hour(e.time) + ' ' : ''}{e.type === 'Match' ? `[${e.level || 'V'}] vs ${e.title}` : e.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRACTICE ATTENDANCE OVERVIEW TAB */}
        {activeTab === 'attendance' && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 overflow-x-auto space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-yellow-400" /> Practice Attendance Overview
              </h2>
              <p className="text-xs text-zinc-400">All players sorted by jersey number</p>
            </div>

            {players.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-6">Add players to start tracking practice attendance.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-3 px-4 font-bold uppercase">Player</th>
                    <th className="py-3 px-4 font-bold uppercase">Level</th>
                    {schedule.filter(s => s.type === 'Practice').slice(0, 5).map(event => (
                      <th key={event.id} className="py-3 px-4 font-bold uppercase text-center min-w-[120px]">
                        <div>{event.title || 'Practice'}</div>
                        <div className="text-[10px] text-zinc-500 font-normal">{event.date}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {practiceAttendancePlayers.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-950/50">
                      <td className="py-3 px-4 font-semibold text-white">
                        #{p.number} {p.name}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{p.level || 'Varsity'}</td>
                      {schedule.filter(s => s.type === 'Practice').slice(0, 5).map(event => {
                        const status = event.attendance?.[p.id] || 'Not Marked';
                        return (
                          <td key={event.id} className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-block ${
                              status === 'Attended'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : status === 'Late'
                                ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                                : status === 'Excused'
                                ? 'bg-blue-400/10 text-blue-400 border border-blue-400/20'
                                : status === 'Absent'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-zinc-800/50 text-zinc-500'
                            }`}>
                              {status}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* LIVE MATCHDAY STAT TRACKER MODAL */}
      {showLiveTracker && activeLiveMatch && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowLiveTracker(false)}
                className="p-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-yellow-400 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    LIVE
                  </span>
                  <h3 className="font-bold text-white text-base">
                    vs {activeLiveMatch.title} ({activeLiveMatch.level || 'Varsity'})
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tap player then stat action (or tap Opponent action directly)
                </p>
              </div>
            </div>

            {/* Scoreboard display */}
            <div className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-2xl">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500">North</span>
                <div className="text-2xl font-black text-yellow-400">{activeLiveMatch.goalsFor || 0}</div>
              </div>
              <span className="text-zinc-600 font-bold">-</span>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Opponent</span>
                <div className="text-2xl font-black text-white">{activeLiveMatch.goalsAgainst || 0}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {/* Step 1: Big Stat Action Buttons + Opponent Quick Trackers */}
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                1. Select Action:
              </p>
              
              {/* North Player Actions */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                {[
                  { key: 'Shot', color: 'bg-zinc-800 text-white border-zinc-700' },
                  { key: 'Goal', color: 'bg-yellow-400 text-zinc-950 font-black border-yellow-300' },
                  { key: 'Assist', color: 'bg-emerald-500 text-zinc-950 font-black border-emerald-400' },
                  { key: 'Yellow Card', color: 'bg-amber-500 text-zinc-950 font-black border-amber-400' },
                  { key: 'Red Card', color: 'bg-red-500 text-white font-black border-red-400' },
                  { key: 'Save', color: 'bg-blue-500 text-white font-black border-blue-400' }
                ].map((act) => {
                  const isSelected = selectedActionForTracker === act.key;
                  return (
                    <button
                      key={act.key}
                      onClick={() => {
                        if (selectedPlayerForTracker) {
                          handleApplyLiveStat(selectedPlayerForTracker, act.key);
                        } else {
                          setSelectedActionForTracker(isSelected ? null : act.key);
                        }
                      }}
                      className={`py-3 rounded-2xl border text-center transition-all shadow-md active:scale-95 ${
                        isSelected 
                          ? 'ring-4 ring-yellow-400 scale-105 z-10 ' + act.color 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-xs font-black">{act.key}</div>
                    </button>
                  );
                })}
              </div>

              {/* Direct Opponent Event Action Buttons */}
              <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-zinc-400">Opponent Actions:</span>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <button
                    onClick={() => handleApplyOpponentStat('Opp. Shot')}
                    className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold border border-zinc-700 rounded-xl text-xs active:scale-95 transition-all"
                  >
                    + Opp. Shot
                  </button>
                  <button
                    onClick={() => handleApplyOpponentStat('Opp. Goal')}
                    className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-black rounded-xl text-xs active:scale-95 transition-all"
                  >
                    + Opp. Goal
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Eligible Player Grid */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  2. Select Player:
                </p>
                {selectedActionForTracker && (
                  <span className="text-xs text-yellow-400 font-bold">
                    Action selected: {selectedActionForTracker} — Tap player to log
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {eligibleMatchPlayers.map((player) => {
                  const isSelected = selectedPlayerForTracker?.id === player.id;
                  const pStats = activeLiveMatch.stats?.[player.id] || {};

                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (selectedActionForTracker) {
                          handleApplyLiveStat(player, selectedActionForTracker);
                        } else {
                          setSelectedPlayerForTracker(isSelected ? null : player);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-yellow-400/20 border-yellow-400 text-white ring-2 ring-yellow-400' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center font-black text-yellow-400 text-sm">
                          #{player.number}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs truncate text-white">{player.name}</div>
                          <div className="text-[10px] text-zinc-400">{player.position}</div>
                        </div>
                      </div>

                      {/* Small current stats indicators */}
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        {pStats.goals > 0 && <span className="bg-yellow-400 text-zinc-950 px-1.5 py-0.5 rounded">G:{pStats.goals}</span>}
                        {pStats.assists > 0 && <span className="bg-emerald-400/20 text-emerald-400 px-1 py-0.5 rounded">A:{pStats.assists}</span>}
                        {pStats.shots > 0 && <span className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded">S:{pStats.shots}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Action Feed Log */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <History className="w-3.5 h-3.5 text-yellow-400" /> Match Event Log ({liveLog.length})
                </h4>
                {liveLog.length > 0 && (
                  <button
                    onClick={handleUndoLiveAction}
                    className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Undo Last Action
                  </button>
                )}
              </div>

              {liveLog.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No stats recorded during this session yet.</p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {liveLog.map((log) => (
                    <div key={log.id} className="flex justify-between items-center bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono">{log.time}</span>
                        <span className="font-bold text-white">
                          {log.isOpponent ? log.playerName : `#${log.playerNumber} ${log.playerName}`}
                        </span>
                      </div>
                      <span className={`font-black uppercase text-[11px] px-2 py-0.5 rounded border ${
                        log.isOpponent 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                          : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex justify-end">
            <button
              onClick={() => setShowLiveTracker(false)}
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs"
            >
              Done & Save Session
            </button>
          </div>
        </div>
      )}

      {/* PRACTICE ATTENDANCE SHEET MODAL */}
      {showAttendanceModal && activeEventForAttendance && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  Practice Attendance: {activeEventForAttendance.title || 'Training Practice'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {activeEventForAttendance.date} {activeEventForAttendance.time && `• ${formatTimeTo12Hour(activeEventForAttendance.time)}`}
                </p>
              </div>
              <button onClick={() => setShowAttendanceModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {practiceAttendancePlayers.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                No players registered in the roster yet.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-3 font-bold uppercase">Player</th>
                      <th className="py-2.5 px-3 font-bold uppercase text-right">Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {practiceAttendancePlayers.map((p) => {
                      const currentStatus = sessionAttendance[p.id];

                      return (
                        <tr key={p.id} className="hover:bg-zinc-950/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">#{p.number} {p.name}</div>
                            <div className="text-[10px] text-zinc-500">{p.position} ({p.level || 'Varsity'})</div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {['Attended', 'Late', 'Excused', 'Absent'].map((st) => {
                                const isSelected = currentStatus === st;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleAttendanceChange(p.id, st)}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                                      isSelected
                                        ? st === 'Attended'
                                          ? 'bg-emerald-500 text-zinc-950 font-black'
                                          : st === 'Late'
                                          ? 'bg-yellow-400 text-zinc-950 font-black'
                                          : st === 'Excused'
                                          ? 'bg-blue-400 text-zinc-950 font-black'
                                          : 'bg-red-500 text-white font-black'
                                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold rounded-xl text-xs shadow-md shadow-emerald-400/10"
              >
                Save Attendance Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATCH STAT SHEET MODAL */}
      {showStatsModal && activeMatchForStats && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-yellow-400" />
                  Match Stat Sheet: vs {activeMatchForStats.title} ({activeMatchForStats.level || 'Varsity'})
                </h3>
                <p className="text-xs text-zinc-400">
                  {activeMatchForStats.date} {activeMatchForStats.time && `• ${formatTimeTo12Hour(activeMatchForStats.time)}`}
                </p>
              </div>
              <button onClick={() => setShowStatsModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {eligibleMatchPlayers.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                No eligible players found for this {activeMatchForStats.level || 'Varsity'} match.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="py-2 px-2 font-bold uppercase">Player</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Played?</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Shots</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Goals</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Assists</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Yellow Cards</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">Red Cards</th>
                      <th className="py-2 px-2 font-bold uppercase text-center">GK Saves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {eligibleMatchPlayers.map((p) => {
                      const pStat = matchStats[p.id] || { played: false, shots: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 0 };
                      const isGK = p.position === 'Goalkeeper';

                      return (
                        <tr key={p.id} className="hover:bg-zinc-950/50">
                          <td className="py-2 px-2">
                            <div className="font-bold text-white">#{p.number} {p.name}</div>
                            <div className="text-[10px] text-zinc-500">{p.position} ({p.level || 'Varsity'})</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleStatChange(p.id, 'played', !pStat.played)}
                              className={`px-3 py-1 rounded-lg font-bold text-xs transition-colors ${
                                pStat.played
                                  ? 'bg-yellow-400 text-zinc-950 font-black'
                                  : 'bg-zinc-950 text-zinc-500 border border-zinc-800'
                              }`}
                            >
                              {pStat.played ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.shots || 0}
                              onChange={(e) => handleStatChange(p.id, 'shots', e.target.value)}
                              className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg py-1 text-center text-white focus:outline-none focus:border-yellow-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.goals || 0}
                              onChange={(e) => handleStatChange(p.id, 'goals', e.target.value)}
                              className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg py-1 text-center font-bold text-yellow-400 focus:outline-none focus:border-yellow-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.assists || 0}
                              onChange={(e) => handleStatChange(p.id, 'assists', e.target.value)}
                              className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg py-1 text-center text-white focus:outline-none focus:border-yellow-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.yellowCards || 0}
                              onChange={(e) => handleStatChange(p.id, 'yellowCards', e.target.value)}
                              className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg py-1 text-center text-yellow-500 focus:outline-none focus:border-yellow-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.redCards || 0}
                              onChange={(e) => handleStatChange(p.id, 'redCards', e.target.value)}
                              className="w-14 bg-zinc-950 border border-zinc-800 rounded-lg py-1 text-center text-red-500 focus:outline-none focus:border-yellow-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={pStat.saves || 0}
                              onChange={(e) => handleStatChange(p.id, 'saves', e.target.value)}
                              disabled={!isGK}
                              className={`w-14 border rounded-lg py-1 text-center font-bold focus:outline-none ${
                                isGK
                                  ? 'bg-zinc-950 border-zinc-800 text-blue-400 focus:border-yellow-400'
                                  : 'bg-zinc-950/30 border-zinc-900 text-zinc-700 cursor-not-allowed'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStats}
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl text-xs shadow-md shadow-yellow-400/10"
              >
                Save Stat Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PLAYER MODAL */}
      {showPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
                {editingPlayer ? 'Edit Squad Player' : 'Add Squad Player'}
              </h3>
              <button 
                onClick={() => { setShowPlayerModal(false); setEditingPlayer(null); }} 
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={newPlayer.name}
                  onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Jersey #</label>
                  <input
                    type="number"
                    value={newPlayer.number}
                    onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Position</label>
                  <select
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Forward">Forward</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Defender">Defender</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Grade</label>
                  <select
                    value={newPlayer.grade}
                    onChange={(e) => setNewPlayer({ ...newPlayer, grade: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Level Designation</label>
                  <select
                    value={newPlayer.level}
                    onChange={(e) => setNewPlayer({ ...newPlayer, level: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Varsity">Varsity</option>
                    <option value="JV">JV</option>
                    <option value="Swing">Swing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Notes</label>
                <input
                  type="text"
                  value={newPlayer.notes}
                  onChange={(e) => setNewPlayer({ ...newPlayer, notes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. Captain, set piece taker"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPlayerModal(false); setEditingPlayer(null); }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl shadow-md shadow-yellow-400/10"
                >
                  {editingPlayer ? 'Update Player' : 'Save Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT EVENT MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">
                {editingEvent ? 'Edit Event' : `Add New ${newEvent.type}`}
              </h3>
              <button 
                onClick={() => { setShowEventModal(false); setEditingEvent(null); }} 
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Event Type</label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Match">Match</option>
                    <option value="Practice">Practice</option>
                  </select>
                </div>
                {newEvent.type === 'Match' ? (
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Match Level</label>
                    <select
                      value={newEvent.level || 'Varsity'}
                      onChange={(e) => setNewEvent({ ...newEvent, level: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                    >
                      <option value="Varsity">Varsity</option>
                      <option value="JV">JV</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-zinc-400 mb-1 font-medium">Status</label>
                    <select
                      value={newEvent.status}
                      onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                )}
              </div>

              {newEvent.type === 'Match' && (
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Status</label>
                  <select
                    value={newEvent.status}
                    onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">
                  {newEvent.type === 'Match' ? 'Opponent Team Name' : 'Session Title / Topic'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newEvent.type === 'Match' ? 'e.g. Central High School' : 'e.g. Tactical Defense & Set Pieces'}
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Time</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Location / Venue</label>
                <input
                  type="text"
                  placeholder="e.g. North Stadium Field A"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              {newEvent.type === 'Match' && newEvent.status === 'Completed' && (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Result</label>
                      <select
                        value={newEvent.result}
                        onChange={(e) => setNewEvent({ ...newEvent, result: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                      >
                        <option value="">Select</option>
                        <option value="Win">Win</option>
                        <option value="Loss">Loss</option>
                        <option value="Draw">Draw</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Goals For</label>
                      <input
                        type="number"
                        min="0"
                        value={newEvent.goalsFor}
                        onChange={(e) => setNewEvent({ ...newEvent, goalsFor: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1 font-medium">Goals Agst</label>
                      <input
                        type="number"
                        min="0"
                        value={newEvent.goalsAgainst}
                        onChange={(e) => setNewEvent({ ...newEvent, goalsAgainst: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Notes / Strategy</label>
                <input
                  type="text"
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="e.g. Wear white jerseys, arrive 45m early"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEventModal(false); setEditingEvent(null); }}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold rounded-xl shadow-md shadow-yellow-400/10"
                >
                  {editingEvent ? 'Update Event' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}