export type UserRole = "admin" | "song_leader" | "musician" | "singer";

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt?: string;
};

export type ChordSection = "verse" | "chorus" | "bridge" | "outro";
export type InstrumentType = "guitar" | "bass" | "keys" | "drums" | "vocals";

export type ChordSheet = {
  id: string;
  songId: string;
  section: ChordSection;
  lyricsWithChords: string;
  instrumentType: InstrumentType;
};

export type ArrangementChordSheet = {
  id: string;
  arrangementId: string;
  section: ChordSection;
  lyricsWithChords: string;
  instrumentType: InstrumentType;
};

export type SongArrangement = {
  id: string;
  songId: string;
  name: string;
  key: string;
  bpm: number;
  timeSignature: string | null;
  message: string | null;
  lyrics: string | null;
  structure: string | null;
  createdAt: string;
  updatedAt: string;
  chordSheets?: ArrangementChordSheet[];
};

export type AudioPlatform = "youtube" | "spotify" | "other";

export type AudioLink = {
  id: string;
  songId: string;
  platform: AudioPlatform;
  url: string;
  label: string | null;
  notes: string | null;
  timestamps: unknown | null;
  createdAt: string;
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
  arrangements?: SongArrangement[];
  audioLinks?: AudioLink[];
};

export type LineupStatus = "draft" | "final" | "published";
export type LineupAudience = "team_all" | "musicians_only";

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
  changeNote?: string | null;
  createdById: string;
  status: LineupStatus;
  audience?: LineupAudience;
  publishedAt: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  songs: LineupSong[];
};

export type SongInstrumentNote = {
  id: string;
  songId: string;
  instrument: InstrumentType;
  body: string;
  updatedAt: string;
  createdAt: string;
};

export type CommentEntityType = "song" | "lineup";

export type Comment = {
  id: string;
  entityType: CommentEntityType;
  entityId: string;
  body: string;
  createdAt: string;
  authorId: string;
  author?: { id: string; name: string | null; email: string };
  mentions?: { userId: string }[];
};
