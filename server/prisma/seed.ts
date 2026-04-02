import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Always ensure demo users exist (login 401 if DB has songs but seed was skipped). */
async function seedUsers() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "admin@church.local" },
    update: {},
    create: {
      email: "admin@church.local",
      passwordHash,
      name: "Admin User",
      role: "admin",
    },
  });

  const leader = await prisma.user.upsert({
    where: { email: "leader@church.local" },
    update: {},
    create: {
      email: "leader@church.local",
      passwordHash,
      name: "Song Leader",
      role: "song_leader",
    },
  });

  await prisma.user.upsert({
    where: { email: "musician@church.local" },
    update: {},
    create: {
      email: "musician@church.local",
      passwordHash,
      name: "Team Musician",
      role: "musician",
    },
  });

  await prisma.user.upsert({
    where: { email: "singer@church.local" },
    update: {},
    create: {
      email: "singer@church.local",
      passwordHash,
      name: "Vocalist",
      role: "singer",
    },
  });

  return leader;
}

async function seedSongsAndLineup(leaderId: string) {
  if ((await prisma.song.count()) > 0) {
    console.log("Database already has songs — skipping demo songs/lineup.");
    return;
  }

  const song1 = await prisma.song.upsert({
    where: { id: "seed-song-1" },
    update: {},
    create: {
      id: "seed-song-1",
      title: "Amazing Grace",
      artist: "John Newton",
      key: "G",
      bpm: 72,
      timeSignature: "3/4",
      message: "God’s grace and redemption",
      tags: ["worship", "traditional", "communion"],
      chordSheets: {
        create: [
          {
            section: "verse",
            instrumentType: "guitar",
            lyricsWithChords:
              "[G]Amazing grace, how [C]sweet the [G]sound\nThat saved a [Em]wretch like [D]me",
          },
          {
            section: "chorus",
            instrumentType: "guitar",
            lyricsWithChords:
              "[G]My chains are [C]gone, I've been [G]set free\nMy [Em]God, my [D]savior has [G]ransomed me",
          },
          {
            section: "verse",
            instrumentType: "bass",
            lyricsWithChords: "G | C | G | Em D |\nG | C | G | D G |",
          },
          {
            section: "verse",
            instrumentType: "keys",
            lyricsWithChords: "Gmaj7 | C | G | Em7 D |\nVoicing: spread triads in root position",
          },
        ],
      },
    },
  });

  const song2 = await prisma.song.create({
    data: {
      id: "seed-song-2",
      title: "Build My Life",
      artist: "Pat Barrett",
      key: "A",
      bpm: 68,
      message: "Surrender and foundation in Christ",
      tags: ["praise", "worship"],
      chordSheets: {
        create: [
          {
            section: "verse",
            instrumentType: "guitar",
            lyricsWithChords:
              "[A]Worthy of every song we could ever [E]sing\n[F#m]Worthy of all the praise we could ever [D]bring",
          },
          {
            section: "chorus",
            instrumentType: "guitar",
            lyricsWithChords:
              "[A]Holy, there is no one like You\n[E]There is none beside You",
          },
          {
            section: "chorus",
            instrumentType: "bass",
            lyricsWithChords: "A | E | F#m | D |",
          },
          {
            section: "bridge",
            instrumentType: "keys",
            lyricsWithChords: "A/C# | E | F#m | D — pad strings, light arpeggio",
          },
        ],
      },
    },
  });

  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
  nextSunday.setHours(12, 0, 0, 0);

  await prisma.lineup.upsert({
    where: { id: "seed-lineup-1" },
    update: {},
    create: {
      id: "seed-lineup-1",
      serviceDate: nextSunday,
      createdById: leaderId,
      status: "published",
      publishedAt: new Date(),
      songs: {
        create: [
          { songId: song1.id, order: 0, selectedKey: "G", notes: "Acoustic intro, 2 bars" },
          { songId: song2.id, order: 1, selectedKey: "Bb", notes: "Capo 3 to match recording; repeat chorus 2x at end" },
        ],
      },
    },
  });

  console.log("Seed OK — demo songs + lineup created.", song1.title, song2.title);
}

async function main() {
  const leader = await seedUsers();
  console.log("Users OK — admin@church.local, leader@church.local, musician@church.local, singer@church.local / password123");

  await seedSongsAndLineup(leader.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
