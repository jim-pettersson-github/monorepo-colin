import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { controlsReady } from './components/ControlSetup';
import { MatchView } from './components/MatchView';
import { StartMenu } from './components/StartMenu';
import type { ClubId, MatchClubs } from './game/clubs';
import { defaultClubs } from './game/clubs';
import { InputManager } from './game/input';
import type { LeagueAction } from './game/league';
import { createLeagueMatch, createSeason, finishLeagueMatch, loadSeason, nextFixture, saveSeason, simulateLeagueMatch } from './game/league';
import type { Difficulty, MatchMode, MatchState, PlaybackSpeed, Team } from './game/model';
import { createMatch } from './game/model';
import { MatchSession } from './game/session';
import { clearMatch, loadMatch, saveMatch } from './game/storage';
import './match.css';

export function App() {
  const [input] = useState(() => new InputManager());
  const [session, setSession] = useState<MatchSession | null>(null);
  const [season, setSeason] = useState(loadSeason);
  const [saved, setSaved] = useState(() => {
    const match = loadMatch();
    return match?.league && (match.league.seasonId !== season?.id || match.league.fixtureId !== (season ? nextFixture(season)?.id : undefined)) ? null : match;
  });
  const [screen, setScreen] = useState<'quick' | 'league'>('quick');
  const [mode, setMode] = useState<MatchMode>('solo');
  const [duration, setDuration] = useState(180);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [clubs, setClubs] = useState<MatchClubs>([...defaultClubs]);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState('');
  const simulationBusy = useRef(false);
  const sessionRef = useRef(session);
  const seasonRef = useRef(season);
  seasonRef.current = season;
  sessionRef.current = session;
  useSyncExternalStore(input.subscribe, input.getSnapshot);

  useEffect(() => {
    let frame = 0;
    const poll = () => {
      input.poll();
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    const pause = () => sessionRef.current?.pause('Matchen pausades när du lämnade spelet.');
    const hidden = () => {
      if (document.hidden) pause();
    };
    const pauseKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && sessionRef.current && !sessionRef.current.paused) {
        event.preventDefault();
        sessionRef.current.pause();
      }
    };
    input.onPause = () => {
      const current = sessionRef.current;
      if (!current) return;
      if (current.paused && (current.state.watching || controlsReady(input, current.state.mode))) current.resume();
      else current.pause();
    };
    input.onDisconnect = (team) => {
      const current = sessionRef.current;
      if (current && !current.state.watching && (team === 0 || current.state.mode === 'versus'))
        current.pause(`Handkontrollen för spelare ${team + 1} kopplades från. Anslut den igen eller välj en annan kontroll.`);
    };
    window.addEventListener('keydown', input.keyDown);
    window.addEventListener('keyup', input.keyUp);
    window.addEventListener('keydown', pauseKey);
    window.addEventListener('blur', pause);
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame);
      input.end();
      window.removeEventListener('keydown', input.keyDown);
      window.removeEventListener('keyup', input.keyUp);
      window.removeEventListener('keydown', pauseKey);
      window.removeEventListener('blur', pause);
      window.removeEventListener('pagehide', pause);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [input]);

  const recordResult = (result: MatchState) => {
    const current = seasonRef.current;
    if (!current || !result.league) return;
    const updated = finishLeagueMatch(current, result);
    if (updated === current) return;
    saveSeason(updated);
    seasonRef.current = updated;
    setSeason(updated);
  };
  const launch = (state: MatchState) => {
    if (simulationBusy.current || (!state.watching && !controlsReady(input, state.mode))) return;
    clearMatch();
    const next = new MatchSession(state, input, recordResult);
    input.begin();
    next.save();
    setSession(next);
    setSaved(null);
  };
  const exit = () => {
    setScreen(session?.state.league ? 'league' : 'quick');
    input.end();
    clearMatch();
    setSession(null);
    setSaved(null);
  };
  if (session)
    return (
      <MatchView
        session={session}
        onExit={exit}
        onRematch={() => {
          launch(createMatch(session.state.mode, session.state.duration, session.state.difficulty, session.state.clubs));
        }}
      />
    );

  const selectClub = (team: Team, id: ClubId) =>
    setClubs((previous) => {
      const next: MatchClubs = [...previous];
      const other = team === 0 ? 1 : 0;
      if (next[other] === id) next[other] = previous[team];
      next[team] = id;
      return next;
    });
  const beginLeague = () => {
    const created = createSeason(clubs[0], difficulty, duration);
    saveSeason(created);
    setSeason(created);
    if (saved?.league) {
      clearMatch();
      setSaved(null);
    }
  };
  const playLeague = async (action: LeagueAction, speed: PlaybackSpeed) => {
    if (!season || simulationBusy.current) return;
    const fixture = nextFixture(season);
    if (!fixture) return;
    const state = saved?.league?.seasonId === season.id && saved.league.fixtureId === fixture.id ? structuredClone(saved) : createLeagueMatch(season);
    if (!state) return;
    state.watching = action !== 'play';
    state.playbackSpeed = action === 'watch' ? speed : 1;
    if (action !== 'simulate') return launch(state);
    simulationBusy.current = true;
    setSimulating(true);
    setSimulationError('');
    saveMatch(state);
    try {
      const result = await simulateLeagueMatch(state, saveMatch);
      recordResult(result);
      clearMatch();
      setSaved(null);
    } catch {
      setSaved(loadMatch());
      setSimulationError('Simuleringen avbröts. Du kan fortsätta den sparade matchen.');
    } finally {
      simulationBusy.current = false;
      setSimulating(false);
    }
  };
  return (
    <StartMenu
      input={input}
      screen={screen}
      onScreen={setScreen}
      mode={mode}
      onMode={setMode}
      clubs={clubs}
      onClub={selectClub}
      duration={duration}
      onDuration={setDuration}
      difficulty={difficulty}
      onDifficulty={setDifficulty}
      season={season}
      saved={saved}
      onQuick={() => launch(createMatch(mode, duration, difficulty, clubs))}
      onResume={() => saved && launch(saved)}
      onSeason={beginLeague}
      onLeagueMatch={playLeague}
      simulating={simulating}
      simulationError={simulationError}
    />
  );
}
