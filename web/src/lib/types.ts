export type UserRole = "admin" | "song_leader" | "musician" | "singer";

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
};

export type ChordSection = "verse" | "chorus" | "bridge" | "outro";
export type InstrumentType = "guitar" | "bass" | "keys";

export type ChordSheet = {
  id: string;
  songId: string;
  section: ChordSection;
  lyricsWithChords: string;
  instrumentType: InstrumentType;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string | null;
  message: string | null;
  lyrics?: string | null;
  tags: string[];
  createdAt: string;
  chordSheets?: ChordSheet[];
};

export type LineupStatus = "draft" | "final" | "published";

export type LineupSong = {
  id: string;
  lineupId: string;
  songId: string;
  order: number;
  selectedKey: string;
  notes: string | null;
  song: Song;
};

export type Lineup = {
  id: string;
  serviceDate: string;
  songLeaderName: string | null;
  createdById: string;
  status: LineupStatus;
  publishedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string };
  songs: LineupSong[];
};
