import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { controlsReady } from './components/ControlSetup';
import { MatchView } from './components/MatchView';
import { StartMenu } from './components/StartMenu';
import { WifiLobby } from './components/WifiLobby';
import type { ClubId, MatchClubs } from './game/clubs';
import { defaultClubs } from './game/clubs';
import { createCup, createCupMatch, cupChampion, finishCupMatch, loadCup, nextCupFixture, saveCup } from './game/cups';
import { InputManager } from './game/input';
import type { LeagueAction } from './game/league';
import { createLeagueMatch, createSeason, finishLeagueMatch, loadSeason, nextFixture, saveSeason, simulateLeagueMatch, standings } from './game/league';
import type { CupKind, Difficulty, MatchMode, MatchState, PlaybackSpeed, Team } from './game/model';
import { createMatch } from './game/model';
import { NetworkSession } from './game/network-session';
import { MatchSession } from './game/session';
import { gameSound } from './game/sound';
import { clearMatch, loadMatch, saveMatch } from './game/storage';
import { loadTransfers, prepareTransferMatch, saveTransfers, settleTransfers, type TransferSave } from './game/transfers';
import './match.css';

export function App() {
  const [transfers, setTransfers] = useState(() => {
    const loaded = loadTransfers();
    if (!loadMatch()) loaded.pending = null;
    return loaded;
  });
  const transfersRef = useRef(transfers);
  transfersRef.current = transfers;
  const updateTransfers = (next: TransferSave) => {
    saveTransfers(next);
    transfersRef.current = next;
    setTransfers(next);
  };
  const [input] = useState(() => new InputManager());
  const [session, setSession] = useState<MatchSession | null>(null);
  const [wifi, setWifi] = useState(false);
  const [wifiFixture, setWifiFixture] = useState<MatchState | null>(null);
  const [cups, setCups] = useState(() => ({ alfred: loadCup('alfred'), masters: loadCup('masters'), world: loadCup('world') }));
  const [cupKind, setCupKind] = useState<CupKind>('alfred');
  const cupsRef = useRef(cups);
  cupsRef.current = cups;
  const [season, setSeason] = useState(loadSeason);
  const [saved, setSaved] = useState(() => {
    const match = loadMatch();
    if (match?.cup) {
      const currentCup = cups[match.cup.kind];
      if (!currentCup || match.cup.runId !== currentCup.id || match.cup.fixtureId !== nextCupFixture(currentCup)?.id) return null;
    }
    return match?.league && (match.league.seasonId !== season?.id || match.league.fixtureId !== (season ? nextFixture(season)?.id : undefined)) ? null : match;
  });
  const [screen, setScreen] = useState<'quick' | 'league' | 'cups' | 'market'>('quick');
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
    gameSound.setForeground(!document.hidden);
    let frame = 0;
    const poll = () => {
      input.poll();
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    const pause = () => {
      gameSound.setForeground(false);
      sessionRef.current?.setForeground(false);
    };
    const focus = () => {
      if (!document.hidden) {
        gameSound.setForeground(true);
        sessionRef.current?.setForeground(true);
      }
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
    window.addEventListener('pointerdown', gameSound.unlock, true);
    window.addEventListener('keydown', gameSound.unlock, true);
    window.addEventListener('keyup', input.keyUp);
    window.addEventListener('keydown', pauseKey);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame);
      input.end();
      gameSound.dispose();
      if (sessionRef.current instanceof NetworkSession) sessionRef.current.dispose();
      window.removeEventListener('keydown', input.keyDown);
      window.removeEventListener('pointerdown', gameSound.unlock, true);
      window.removeEventListener('keydown', gameSound.unlock, true);
      window.removeEventListener('keyup', input.keyUp);
      window.removeEventListener('keydown', pauseKey);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', pause);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [input]);

  const recordResult = (result: MatchState) => {
    if (result.cup) {
      const current = cupsRef.current[result.cup.kind];
      if (!current) return;
      const updated = finishCupMatch(current, result);
      if (updated === current) return;
      const champion = cupChampion(updated);
      const bonus =
        champion === updated.club
          ? { id: `cup:${updated.id}`, amount: updated.kind === 'alfred' ? 6000 : updated.kind === 'masters' ? 8000 : 10000 }
          : undefined;
      updateTransfers(settleTransfers(transfersRef.current, result, bonus));
      saveCup(updated);
      const next = { ...cupsRef.current, [updated.kind]: updated };
      cupsRef.current = next;
      setCups(next);
      const pending = loadMatch();
      if (pending?.cup?.runId === result.cup.runId && pending.cup.fixtureId === result.cup.fixtureId) {
        clearMatch();
        setSaved(null);
      }
      return;
    }
    const current = seasonRef.current;
    if (!result.league) {
      updateTransfers(settleTransfers(transfersRef.current, result));
      return;
    }
    if (!current) return;
    const updated = finishLeagueMatch(current, result);
    if (updated === current) return;
    const complete = updated.fixtures.every((fixture) => fixture.score);
    const place = complete ? standings(updated).findIndex((row) => row.club === updated.club) : -1;
    const bonus = place >= 0 && place < 3 ? { id: `league:${updated.id}`, amount: [8000, 4000, 2000][place] } : undefined;
    updateTransfers(settleTransfers(transfersRef.current, result, bonus));
    saveSeason(updated);
    seasonRef.current = updated;
    setSeason(updated);
    const pending = loadMatch();
    if (pending?.league?.seasonId === result.league.seasonId && pending.league.fixtureId === result.league.fixtureId) {
      clearMatch();
      setSaved(null);
    }
  };
  const launch = (state: MatchState) => {
    if (simulationBusy.current || (!state.watching && !controlsReady(input, state.mode))) return;
    const prepared = prepareTransferMatch(transfersRef.current, state);
    state = prepared.state;
    updateTransfers(prepared.save);
    clearMatch();
    const next = new MatchSession(state, input, recordResult);
    input.begin(state.mode === 'versus' ? [0, 1] : [0]);
    next.save();
    setSession(next);
    setSaved(null);
  };
  const exit = () => {
    if (session?.networkRole !== 'guest' && transfersRef.current.pending) updateTransfers({ ...transfersRef.current, pending: null });
    if (session instanceof NetworkSession) {
      session.dispose();
      input.end();
      setSession(null);
      setWifi(!(session.state.league || session.state.cup) || session.networkRole === 'guest');
      setWifiFixture(null);
      if (session.state.league && session.networkRole === 'host') setScreen('league');
      if (session.state.cup && session.networkRole === 'host') {
        setScreen('cups');
        setCupKind(session.state.cup.kind);
      }
      return;
    }
    setScreen(session?.state.cup ? 'cups' : session?.state.league ? 'league' : 'quick');
    if (session?.state.cup) setCupKind(session.state.cup.kind);
    input.end();
    clearMatch();
    setSession(null);
    setSaved(null);
  };
  if (session)
    return (
      <MatchView
        session={session}
        reward={transfers.lastReward}
        onMarket={() => {
          exit();
          setWifi(false);
          setScreen('market');
        }}
        onExit={exit}
        onRematch={() => {
          if (session instanceof NetworkSession) {
            if (!session.canResume || session.networkRole !== 'host') return;
            const prepared = prepareTransferMatch(
              transfersRef.current,
              createMatch('versus', session.state.duration, session.state.difficulty, session.state.clubs),
            );
            updateTransfers(prepared.save);
            return session.rematch(prepared.state);
          }
          launch(createMatch(session.state.mode, session.state.duration, session.state.difficulty, session.state.clubs));
        }}
      />
    );

  if (wifi)
    return (
      <WifiLobby
        input={input}
        fixture={wifiFixture}
        onBack={() => {
          setWifi(false);
          setWifiFixture(null);
        }}
        onLaunch={(link, state) => {
          if (link.role === 'host') {
            const prepared = prepareTransferMatch(transfersRef.current, state);
            state = prepared.state;
            updateTransfers(prepared.save);
          }
          input.begin([0]);
          const next = new NetworkSession(state, input, link, recordResult);
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
  const beginLeague = (continuing = false) => {
    const previous = seasonRef.current;
    const club = continuing && previous ? previous.club : clubs[0];
    const created = createSeason(
      club,
      continuing && previous ? previous.difficulty : difficulty,
      continuing && previous ? previous.duration : duration,
      previous ?? undefined,
    );
    seasonRef.current = created;
    saveSeason(created);
    setSeason(created);
    if (saved?.league) {
      if (transfersRef.current.pending === saved.career?.id) updateTransfers({ ...transfersRef.current, pending: null });
      clearMatch();
      setSaved(null);
    }
  };
  const playCompetition = async (state: MatchState, action: LeagueAction, speed: PlaybackSpeed) => {
    if (simulationBusy.current) return;
    state.mode = action === 'local' || action === 'wifi' ? 'versus' : 'solo';
    state.watching = action === 'watch' || action === 'simulate';
    state.playbackSpeed = action === 'watch' ? speed : 1;
    if (action === 'wifi') {
      setWifiFixture(state);
      setWifi(true);
      return;
    }
    if (action !== 'simulate') return launch(state);
    simulationBusy.current = true;
    const prepared = prepareTransferMatch(transfersRef.current, state);
    state = prepared.state;
    updateTransfers(prepared.save);
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
  const playLeague = (action: LeagueAction, speed: PlaybackSpeed) => {
    if (!season) return;
    const fixture = nextFixture(season);
    if (!fixture) return;
    const state = saved?.league?.seasonId === season.id && saved.league.fixtureId === fixture.id ? structuredClone(saved) : createLeagueMatch(season);
    if (state) void playCompetition(state, action, speed);
  };
  const beginCup = (kind: CupKind, club: ClubId, level: Difficulty, length: number) => {
    const created = createCup(kind, club, level, length);
    saveCup(created);
    const next = { ...cupsRef.current, [kind]: created };
    cupsRef.current = next;
    setCups(next);
    setCupKind(kind);
    if (saved?.cup?.kind === kind) {
      if (transfersRef.current.pending === saved.career?.id) updateTransfers({ ...transfersRef.current, pending: null });
      clearMatch();
      setSaved(null);
    }
  };
  const playCup = (kind: CupKind, action: LeagueAction, speed: PlaybackSpeed) => {
    const cup = cupsRef.current[kind];
    if (!cup) return;
    const fixture = nextCupFixture(cup);
    if (!fixture) return;
    const state = saved?.cup?.runId === cup.id && saved.cup.fixtureId === fixture.id ? structuredClone(saved) : createCupMatch(cup);
    setCupKind(kind);
    if (state) void playCompetition(state, action, speed);
  };
  return (
    <StartMenu
      transfers={transfers}
      onTransfers={updateTransfers}
      input={input}
      cups={cups}
      cupKind={cupKind}
      onCupKind={setCupKind}
      onCreateCup={beginCup}
      onCupMatch={playCup}
      onWifi={() => {
        setWifiFixture(null);
        setWifi(true);
      }}
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
