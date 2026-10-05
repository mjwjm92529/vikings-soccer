import React, { useState, useMemo } from 'react';

export function RosterTab({ players = [], onEditPlayer, onDeletePlayer, onAddPlayer }) {
  // Filter & Sort State
  const [teamFilter, setTeamFilter] = useState('All');
  const [sortBy, setSortBy] = useState('number'); // 'number' | 'name' | 'gamesPlayed' | 'goals' | 'assists' | 'shots'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Handle sort field changes and auto-set intuitive default directions
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(newSortBy);
      // Stats default to descending (highest stats top), identity default to ascending
      const isStat = ['gamesPlayed', 'goals', 'assists', 'shots'].includes(newSortBy);
      setSortDirection(isStat ? 'desc' : 'asc');
    }
  };

  // Filter and sort the players list dynamically
  const processedPlayers = useMemo(() => {
    return players
      .filter((player) => {
        if (teamFilter === 'All') return true;
        return (player.team || '').toLowerCase() === teamFilter.toLowerCase();
      })
      .sort((a, b) => {
        let valA = a[sortBy] ?? 0;
        let valB = b[sortBy] ?? 0;

        // String comparison fallback for names or text fields
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [players, teamFilter, sortBy, sortDirection]);

  return (
    <div className="space-y-6">
      {/* Controls Bar: Filtering and Sorting */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-md">
        
        {/* Team Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Team:</span>
          <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 w-full md:w-auto">
            {['All', 'Varsity', 'JV'].map((team) => (
              <button
                key={team}
                onClick={() => setTeamFilter(team)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex-1 md:flex-none ${
                  teamFilter === team
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none w-full md:w-auto cursor-pointer"
          >
            <option value="number">Jersey #</option>
            <option value="name">Player Name</option>
            <option value="gamesPlayed">Games Played</option>
            <option value="goals">Goals</option>
            <option value="assists">Assists</option>
            <option value="shots">Shots</option>
          </select>

          <button
            onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 text-sm font-bold transition-all flex items-center gap-1 shrink-0"
            title="Toggle Ascending/Descending"
          >
            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            <span className="uppercase text-xs">{sortDirection}</span>
          </button>
        </div>
      </div>

      {/* Roster Display Table */}
      <div className="overflow-x-auto bg-gray-800 rounded-xl border border-gray-700 shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-900/60 text-gray-400 border-b border-gray-700 text-xs uppercase tracking-wider">
              <th className="py-3 px-4">#</th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Team</th>
              <th className="py-3 px-4 text-center">GP</th>
              <th className="py-3 px-4 text-center">Goals</th>
              <th className="py-3 px-4 text-center">Assists</th>
              <th className="py-3 px-4 text-center">Shots</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-sm">
            {processedPlayers.length > 0 ? (
              processedPlayers.map((player) => (
                <tr key={player.id || player.number} className="hover:bg-gray-750 transition-colors">
                  <td className="py-3 px-4 font-bold text-blue-400">{player.number}</td>
                  <td className="py-3 px-4 font-semibold text-white">{player.name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        player.team?.toLowerCase() === 'varsity'
                          ? 'bg-purple-900/50 text-purple-300 border border-purple-700'
                          : 'bg-green-900/50 text-green-300 border border-green-700'
                      }`}
                    >
                      {player.team || 'Unassigned'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono">{player.gamesPlayed ?? 0}</td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-400 font-bold">{player.goals ?? 0}</td>
                  <td className="py-3 px-4 text-center font-mono text-cyan-400">{player.assists ?? 0}</td>
                  <td className="py-3 px-4 text-center font-mono text-yellow-400">{player.shots ?? 0}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {onEditPlayer && (
                      <button
                        onClick={() => onEditPlayer(player)}
                        className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {onDeletePlayer && (
                      <button
                        onClick={() => onDeletePlayer(player.id)}
                        className="text-xs px-2.5 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded border border-red-700/50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="py-8 text-center text-gray-400">
                  No players found matching team category <span className="font-semibold text-white">"{teamFilter}"</span>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}