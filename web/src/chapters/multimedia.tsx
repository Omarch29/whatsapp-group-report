import { copy } from "../../content/copy";
import { RecordPair } from "@/components/RecordPair";
import { Block } from "@/components/report/Block";
import { ChapterPager } from "@/components/report/ChapterPager";
import { Painted } from "@/components/report/Painted";
import { Audios } from "@/components/sections/media/Audios";
import { DeletedEdited } from "@/components/sections/media/DeletedEdited";
import { Kinds } from "@/components/sections/media/Kinds";
import { Links } from "@/components/sections/media/Links";
import { MediaRecords, RECORD_KINDS } from "@/components/sections/media/MediaRecords";
import { chapterById } from "@/lib/chapters";
import { loadGlobal, loadMedia, loadRecords } from "@/lib/data";
import { personName } from "@/lib/language";
import { kindGroups, peakIndex, top, topKind } from "@/lib/media";
import styles from "./chapter.module.css";

export default async function Multimedia() {
  const [g, media, records] = await Promise.all([loadGlobal(), loadMedia(), loadRecords()]);
  const { people } = g;
  const title = (id: string) => chapterById("multimedia").blocks.find((b) => b.id === id)!.title;
  const nameOf = (slug: string) => personName(slug, people);
  const m = copy.media;
  const label = (kind: string) => m.kindLabels[kind] ?? kind;

  // Kinds
  const common = topKind(media.kinds);
  // The lede speaks for the whole group: records.json's total counts the resto too (the bars only profiled people).
  const kindsLede = common
    ? m.kindsLede(label(common.kind), records.media[common.kind]?.total ?? common.n)
    : copy.empty;
  const folded = kindGroups(media.kinds.kinds).other.map(label).join(", ");
  const stickerDay = records.media.sticker?.recordDay;

  // The three "el más …" records
  const tops = RECORD_KINDS.flatMap((kind) => {
    const t = records.media[kind]?.byPerson[0];
    return t ? [{ slug: t.slug, name: nameOf(t.slug), n: t.n, unit: m.records[kind]!.unit(t.n) }] : [];
  });

  // Audios
  // A chat without audio has no audios block (chaptersFor drops it from the sidebar too).
  const { audios } = media;
  const hasAudios = audios.byPerson.length > 0;
  const audioTop = top(audios.byPerson, (p) => p.n);
  const peakHour = peakIndex(audios.byHour);
  const audiosLede = audioTop && peakHour >= 0 ? m.audiosLede(nameOf(audioTop.slug), audioTop.n, peakHour) : copy.empty;
  const audioDay = records.media.audio?.recordDay;

  // Links
  const { links } = media;
  const sharer = top(links.byPerson, (p) => p.n);
  const domain = top(links.domains, (d) => d.n);
  const linksLede = sharer && domain ? m.linksLede(nameOf(sharer.slug), sharer.n, domain.domain, domain.n) : copy.empty;
  const sharerFavorite = sharer && links.favorite.find((f) => f.slug === sharer.slug);

  // Deleted and edited
  const de = media.deletedEdited;
  const deleter = top(de.byPerson, (p) => p.deletedPerMil);
  const editor = top(de.byPerson, (p) => p.editedPerMil);
  const deletedLede =
    deleter && editor
      ? m.deletedLede(nameOf(deleter.slug), deleter.deletedPerMil, nameOf(editor.slug), editor.editedPerMil)
      : copy.empty;

  return (
    <main className={styles.chapter}>
      <h2 className={styles.heading}>{chapterById("multimedia").title}</h2>

      <Block
        id="kinds"
        title={title("kinds")}
        lede={kindsLede}
        criterion={m.kindsCriterion(folded)}
        record={
          stickerDay && (
            <RecordPair
              label={m.stickerDay.label}
              record={{ value: stickerDay.n, unit: m.stickerDay.unit(stickerDay.n), who: stickerDay.who, when: stickerDay.date }}
              caption={m.stickerDay.caption}
              people={people}
            />
          )
        }
      >
        <Kinds data={media.kinds} people={people} />
      </Block>

      <Block
        id="media-records"
        title={title("media-records")}
        lede={
          tops.length ? (
            <Painted text={m.recordsLede(tops)} who={tops.map((t) => t.slug)} people={people} />
          ) : (
            copy.empty
          )
        }
        criterion={m.recordsCriterion}
      >
        <MediaRecords media={records.media} people={people} />
      </Block>

      {hasAudios && (
        <Block
          id="audios"
          title={title("audios")}
          lede={<Painted text={audiosLede} who={audioTop ? [audioTop.slug] : []} people={people} />}
          criterion={m.audiosCriterion}
          record={
            audioDay && (
              <RecordPair
                label={m.audioDay.label}
                record={{ value: audioDay.n, unit: m.audioDay.unit(audioDay.n), who: audioDay.who, when: audioDay.date }}
                caption={m.audioDay.caption}
                people={people}
              />
            )
          }
        >
          <Audios data={audios} people={people} />
        </Block>
      )}

      <Block
        id="links"
        title={title("links")}
        lede={<Painted text={linksLede} who={sharer ? [sharer.slug] : []} people={people} />}
        criterion={m.linksCriterion}
        record={
          sharer && (
            <RecordPair
              label={m.topSharer.label}
              record={{ value: sharer.n, unit: m.topSharer.unit(sharer.n), who: sharer.slug, when: "", whenLabel: m.inTotal }}
              caption={sharerFavorite ? m.favoriteCaption(sharerFavorite.domain, sharerFavorite.n) : undefined}
              people={people}
            />
          )
        }
      >
        <Links data={links} people={people} />
      </Block>

      <Block
        id="deleted-edited"
        title={title("deleted-edited")}
        lede={
          <Painted
            text={deletedLede}
            who={[deleter?.slug, editor?.slug].filter((s) => s !== undefined)}
            people={people}
          />
        }
        criterion={m.deletedCriterion}
        record={
          de.recordDay && (
            <RecordPair
              label={m.deletedDay.label}
              record={{ value: de.recordDay.n, unit: m.deletedDay.unit(de.recordDay.n), when: de.recordDay.date }}
              caption={m.deletedDay.caption}
              people={people}
            />
          )
        }
      >
        <DeletedEdited data={de} people={people} />
      </Block>

      <ChapterPager id="multimedia" />
    </main>
  );
}
