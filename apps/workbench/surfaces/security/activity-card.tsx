'use client';

// The account's activity record — who did what, when.
//
// This is the HUMAN feed (api-rest /v1/activity), not the raw forensic dump: it
// arrives already turned into sentences with real names attached, which is what
// a business owner needs to answer "did someone change my prices, and who?".
// Each row wears a state-colored badge for the KIND of change, so a long run of
// history is scannable — removals red, new things green, edits blue — rather
// than a grey wall of identical lines.
//
// It grows in steps instead of paging: this is a recent-history view someone
// skims from the top, so "Show more" pulling the next slice reads more honestly
// than page numbers on a feed that only ever gets longer.

import {
    Alert,
    AlertActions,
    AlertContent,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    EmptyState,
    Text,
    Timestamp,
} from '@wizeworks/silicaui-react';
import { History } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { ACTIVITY_MAX, activityKindLabel, activityTone, type ActivityEntry } from './security-data';

interface ActivityCardProps {
    entries: ActivityEntry[] | undefined;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    limit: number;
    refetch: () => void;
    onShowMore: () => void;
}

export function ActivityCard({
    entries,
    isPending,
    isError,
    isFetching,
    limit,
    refetch,
    onShowMore,
}: ActivityCardProps) {
    const rows = entries ?? [];
    // The endpoint returns exactly `limit` rows when more exist, fewer when the
    // history runs out — so a full page is the signal there may be more to show.
    const mayHaveMore = rows.length >= limit && limit < ACTIVITY_MAX;

    return (
        <FormSection
            title="Recent account activity"
            description="A record of the things people have done in your account, newest first. Only actions are listed here — simply looking at something is not."
        >
            {isError ? (
                <Alert color="error" variant="soft">
                    <AlertContent>
                        <AlertTitle>Could not load your activity</AlertTitle>
                        <AlertDescription>
                            This is a problem reaching the server. Your account record is unaffected.
                        </AlertDescription>
                    </AlertContent>
                    <AlertActions>
                        <Button
                            size="sm"
                            color="error"
                            variant="soft"
                            onClick={() => {
                                refetch();
                            }}
                        >
                            Try again
                        </Button>
                    </AlertActions>
                </Alert>
            ) : isPending ? (
                <p className="text-sm" role="status">
                    Loading your activity…
                </p>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={<History className="size-6" aria-hidden />}
                    title="Nothing has happened yet"
                    description="As you and your team work in your account, everything you do shows up here."
                />
            ) : (
                <>
                    <ul className="flex flex-col">
                        {rows.map((entry, index) => (
                            <li
                                key={entry.id}
                                className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${index === 0 ? '' : 'border-base-300 border-t'
                                    }`}
                            >
                                <Badge
                                    color={activityTone(entry.action)}
                                    variant="soft"
                                    size="sm"
                                    className="shrink-0"
                                >
                                    {activityKindLabel(entry.action)}
                                </Badge>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="font-medium">
                                        {entry.title}
                                        {entry.subject ? <span className="font-normal"> — {entry.subject}</span> : null}
                                    </span>
                                    <Text className="text-sm">
                                        {entry.actor.name ?? 'sparx'} ·{' '}
                                        <Timestamp value={new Date(entry.at).getTime()} format="relative" />
                                    </Text>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {mayHaveMore ? (
                        <div className="flex justify-center pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                color="neutral"
                                loading={isFetching}
                                onClick={onShowMore}
                            >
                                Show more
                            </Button>
                        </div>
                    ) : (
                        <Text className="pt-1 text-center text-sm">
                            {limit >= ACTIVITY_MAX
                                ? 'Showing the most recent activity.'
                                : 'That is everything so far.'}
                        </Text>
                    )}
                </>
            )}
        </FormSection>
    );
}
