import { nations } from './nations';

export const clubs = [
  { id: 'alfred', name: 'Alfred FF', code: 'AFF', shirt: '#59b9d7', trim: '#f3f6ed' },
  { id: 'brick', name: 'IFK Göteborg', code: 'IFG', shirt: '#f47c68', trim: '#213c51' },
  { id: 'solstad', name: 'Norrköping FC', code: 'NFC', shirt: '#f3ca59', trim: '#253342' },
  { id: 'skogsby', name: 'Colin FF', code: 'CFF', shirt: '#b5d36b', trim: '#244738' },
  { id: 'havsvik', name: 'Charlie FC', code: 'CFC', shirt: '#8e9bff', trim: '#f3f6ed' },
  { id: 'bergdal', name: 'Växjö IF', code: 'VIF', shirt: '#d5c9bb', trim: '#674735' },
  { id: 'blixten', name: 'Malmö IF', code: 'MIF', shirt: '#c98cf5', trim: '#f3ca59' },
  { id: 'eldstad', name: 'Jim FF', code: 'JFF', shirt: '#f39b53', trim: '#253342' },
  { id: 'isbjorn', name: 'IFK Älmhult', code: 'IFÄ', shirt: '#e8f3f6', trim: '#3984ba' },
  { id: 'stjarnlaget', name: 'IFK Örebro', code: 'IFÖ', shirt: '#ed91be', trim: '#f3f6ed' },
  { id: 'draken', name: 'Värnamo FF', code: 'VFF', shirt: '#56d2c0', trim: '#244738' },
  { id: 'klosskoping', name: 'IFK Lund', code: 'IFK', shirt: '#c4b2fb', trim: '#674735' },
] as const;

export type ClubId = (typeof clubs)[number]['id'] | (typeof nations)[number]['id'];
export interface FootballTeam {
  id: ClubId;
  name: string;
  code: string;
  shirt: string;
  trim: string;
  awayShirt?: string;
  awayTrim?: string;
}
export type MatchClubs = [ClubId, ClubId];
export const defaultClubs: MatchClubs = ['alfred', 'brick'];
export const getClub = (id: ClubId): FootballTeam => clubs.find((club) => club.id === id) || nations.find((nation) => nation.id === id) || clubs[0];
export const validClub = (id: unknown): id is ClubId => clubs.some((club) => club.id === id) || nations.some((nation) => nation.id === id);

export function getMatchClubs(value: { clubs: MatchClubs }) {
  // Open sessions from the earlier two-team build keep their original clubs.
  const teams = (value.clubs || defaultClubs).map(getClub);
  const rgb = (color: string) => [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((value, i) => value - rgb(b)[i]));
  const away = teams[1];
  if (away.awayShirt && distance(teams[0].shirt, away.shirt) < 110 && distance(teams[0].shirt, away.awayShirt) > distance(teams[0].shirt, away.shirt))
    teams[1] = { ...away, shirt: away.awayShirt, trim: away.awayTrim ?? away.trim };
  return teams;
}
