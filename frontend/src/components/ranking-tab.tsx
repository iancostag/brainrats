"use client";

import { Scale, Trophy } from "lucide-react";

import { ChallengeSwitcher } from "@/components/challenge-switcher";
import { RulesPanel } from "@/components/rules-panel";
import { Podium, Scoreboard } from "@/components/scoreboard";
import { PageHeader } from "@/components/ui";
import type { ChallengeDetail, ChallengeListItem } from "@/lib/api";
import { sortLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";

interface RankingTabProps {
  detail: ChallengeDetail;
  challenges: ChallengeListItem[];
  activeChallengeId: string;
  onChangeChallenge: (id: string) => void;
  sort: LeaderboardSort;
  onSortChange: (next: LeaderboardSort) => void;
  currentUserId: string;
  copiedInvite: boolean;
  onCopyInvite: () => void;
}

/** Ranking completo do desafio ativo: pódio (3+ atletas), lista inteira e regras de pontuação. */
export function RankingTab({
  detail,
  challenges,
  activeChallengeId,
  onChangeChallenge,
  sort,
  onSortChange,
  currentUserId,
  copiedInvite,
  onCopyInvite,
}: RankingTabProps) {
  const sorted = sortLeaderboard(detail.leaderboard, sort);
  const scoringMode = detail.challenge.scoring_mode;
  const hasPodium = sorted.length >= 3;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Trophy}
        title="Ranking"
        description={detail.challenge.title}
        aside={
          <ChallengeSwitcher
            challenges={challenges}
            value={activeChallengeId}
            onChange={onChangeChallenge}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          {hasPodium && (
            <section aria-label="Pódio" className="card px-4 pt-8 sm:px-8">
              <Podium
                entries={sorted}
                sort={sort}
                scoringMode={scoringMode}
                currentUserId={currentUserId}
              />
            </section>
          )}
          <Scoreboard
            title="Classificação completa"
            entries={sorted}
            sort={sort}
            onSortChange={onSortChange}
            currentUserId={currentUserId}
            scoringMode={scoringMode}
            inviteCode={detail.challenge.invite_code}
            copiedInvite={copiedInvite}
            onCopyInvite={onCopyInvite}
          />
        </div>

        <section aria-labelledby="rules-title" className="card self-start p-5">
          <h2 id="rules-title" className="section-title">
            <Scale className="h-5 w-5 text-accent-text" aria-hidden="true" />
            Como a pontuação funciona
          </h2>
          <p className="mt-1 text-xs text-ink-2">
            O placar soma só check-ins válidos. Empates em pontos são decididos pela ofensiva e
            depois pelos dias ativos.
          </p>
          <RulesPanel detail={detail} className="mt-4 [&_ul.grid]:grid-cols-1" />
        </section>
      </div>
    </div>
  );
}
