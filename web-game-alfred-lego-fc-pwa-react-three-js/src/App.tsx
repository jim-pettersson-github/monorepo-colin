import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { controlsReady } from './components/ControlSetup';
import { MatchView } from './components/MatchView';
import { StartMenu } from './components/StartMenu';
import { WifiLobby } from './components/WifiLobby';
import type { ClubId, MatchClubs } from './game/clubs';
import { defaultClubs } from './game/clubs';
import { InputManager } from './game/input';
import type { LeagueAction } from './game/league';
import { createLeagueMatch, createSeason, finishLeagueMatch, loadSeason, nextFixture, saveSeason, simulateLeagueMatch } from './game/league';
import type { Difficulty, MatchMode, MatchState, PlaybackSpeed, Team } from './game/model';
import { createMatch } from './game/model';
import { NetworkSession } from './game/network-session';
import { MatchSession } from './game/session';
import { clearMatch, loadMatch, saveMatch } from './game/storage';
import './match.css';

export function App() {
  const [input] = useState(() => new InputManager());
  const [session, setSession] = useState<MatchSession | null>(null);
  const [wifi, setWifi] = useState(false);
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
    const pause = () => sessionRef.current?.setForeground(false);
    const focus = () => {
      if (!document.hidden) sessionRef.current?.setForeground(true);
    };
    const hidden = () => {
      if (document.hidden) pause();
      else focus();
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
      if (
        current.paused &&
        current.canResume &&
        (current.networkRole ? input.available(0) : current.state.watching || controlsReady(input, current.state.mode))
      )
        current.resume();
      else current.pause();
    };
    input.onDisconnect = (team) => {
      const current = sessionRef.current;
      if (current?.networkRole && team === 1) return;
      if (current && !current.state.watching && (team === 0 || current.state.mode === 'versus'))
        current.pause(`Handkontrollen för spelare ${(current.localTeam ?? team) + 1} kopplades från. Anslut den igen eller välj en annan kontroll.`);
    };
    window.addEventListener('keydown', input.keyDown);
    window.addEventListener('keyup', input.keyUp);
    window.addEventListener('keydown', pauseKey);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame);
      input.end();
      if (sessionRef.current instanceof NetworkSession) sessionRef.current.dispose();
      window.removeEventListener('keydown', input.keyDown);
      window.removeEventListener('keyup', input.keyUp);
      window.removeEventListener('keydown', pauseKey);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', focus);
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
    input.begin(state.mode === 'versus' ? [0, 1] : [0]);
    next.save();
    setSession(next);
    setSaved(null);
  };
  const exit = () => {
    if (session instanceof NetworkSession) {
      session.dispose();
      input.end();
      setSession(null);
      setWifi(true);
      return;
    }
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
          if (session instanceof NetworkSession) return session.rematch();
          launch(createMatch(session.state.mode, session.state.duration, session.state.difficulty, session.state.clubs));
        }}
      />
    );

  if (wifi)
    return (
      <WifiLobby
        input={input}
        onBack={() => setWifi(false)}
        onLaunch={(link, state) => {
          input.begin([0]);
          const next = new NetworkSession(state, input, link);
          next.setForeground(!document.hidden);
          setSession(next);
          setWifi(false);
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
      onWifi={() => setWifi(true)}
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
