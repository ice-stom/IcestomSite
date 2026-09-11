import { api } from './api.js';
import { byId, el, empty, modal, replace, toast } from './dom.js';

export function createRunPane(ctx) {
    const definitionList = byId('definition-list');
    const eventList = byId('event-list');

    function render() {
        renderDefinitions();
        renderEvents();
    }

    function renderDefinitions() {
        const definitions = ctx.getBootstrap()?.definitions ?? [];

        if (definitions.length === 0) {
            replace(definitionList, empty('No event definitions yet. Build one in the Build tab.'));
            return;
        }

        replace(definitionList, definitions.map(definitionCard));
    }

    function definitionCard(definition) {
        const actions = [
            el('button', {
                class: 'button button-primary button-small',
                text: 'Start',
                onClick: () => startEvent(definition),
            }),
        ];

        if (definition.editable) {
            actions.push(el('button', {
                class: 'button button-small',
                text: 'Edit',
                onClick: () => ctx.openInBuilder(definition),
            }));
        }

        actions.push(el('button', {
            class: 'button button-danger button-small',
            text: 'Delete',
            onClick: () => deleteDefinition(definition),
        }));

        return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
                el('div', {}, [
                    el('h3', { class: 'card-title', text: definition.title || definition.name }),
                    el('p', { class: 'card-sub', text: definition.name }),
                ]),
                el('div', { class: 'card-actions' }, actions),
            ]),
            definition.editable
                ? null
                : el('p', { class: 'field-hint', text: 'Hand written, so it can be run but not edited here.' }),
        ]);
    }

    async function startEvent(definition) {
        const players = ctx.getState()?.players ?? [];

        if (players.length === 0) {
            toast('Nobody is online to take part.', 'error');
            return;
        }

        const checklist = el('div', { class: 'checklist' }, players.map((player) =>
            el('label', {}, [
                el('input', {
                    type: 'checkbox',
                    value: player.uuid,
                    checked: !player.inEvent,
                }),
                el('span', { text: player.name }),
                player.inEvent ? el('span', { class: 'busy', text: 'already in an event' }) : null,
            ])
        ));

        const confirmed = await modal({
            title: `Start ${definition.title || definition.name}`,
            body: [
                el('p', { class: 'field-hint', text: 'Everyone ticked will be pulled into the first stage.' }),
                checklist,
            ],
            confirmLabel: 'Start event',
        });

        if (!confirmed) return;

        const participants = [...checklist.querySelectorAll('input:checked')].map((input) => input.value);

        try {
            await api.runEvent(definition.name, participants);
            toast(`Started ${definition.title || definition.name}.`, 'good');
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    async function deleteDefinition(definition) {
        const confirmed = await modal({
            title: 'Delete this event?',
            body: el('p', { text: `${definition.name} will be removed from the server's events folder. This cannot be undone.` }),
            confirmLabel: 'Delete',
        });

        if (!confirmed) return;

        try {
            await api.deleteDefinition(definition.name);
            await ctx.refreshBootstrap();
            toast(`Deleted ${definition.name}.`, 'good');
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    function renderEvents() {
        const events = ctx.getState()?.events ?? [];

        if (events.length === 0) {
            replace(eventList, empty('Nothing is running. Start an event from the left.'));
            return;
        }

        replace(eventList, events.map(eventCard));
    }

    function eventCard(event) {
        const stages = event.stages.length === 0
            ? [el('p', { class: 'field-hint', text: 'Starting up, no stages yet.' })]
            : event.stages.map((stage) => stageCard(event, stage));

        return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
                el('div', {}, [
                    el('h3', { class: 'card-title', text: event.name }),
                    el('p', { class: 'card-sub', text: event.id }),
                ]),
                el('div', { class: 'card-actions' }, [
                    el('button', {
                        class: 'button button-danger button-small',
                        text: 'Cancel',
                        onClick: () => cancelEvent(event),
                    }),
                ]),
            ]),
            el('div', { style: 'margin-top:12px' }, stages),
        ]);
    }

    function stageCard(event, stage) {
        const players = stage.players.length === 0
            ? [el('span', { class: 'field-hint', text: 'Nobody here yet.' })]
            : stage.players.map((player) => el('span', { class: 'player-chip', text: player.name }));

        const transitions = stage.transitions.map((transition) =>
            el('button', {
                class: 'button button-small',
                text: transition.name,
                title: `Moves this stage to ${transition.to}`,
                onClick: (event2) => runTransition(event2.currentTarget, event, stage, transition),
            })
        );

        return el('div', { class: 'stage' }, [
            el('div', { class: 'stage-head' }, [
                el('span', { class: 'stage-name', text: stage.name }),
                stage.type ? el('span', { class: 'stage-type', text: stage.type }) : null,
                el('span', {
                    class: `pill ${stage.state ? '' : 'is-idle'}`,
                    text: stage.state ?? 'no state',
                }),
            ]),
            el('div', { class: 'stage-players' }, players),
            transitions.length > 0 ? el('div', { class: 'stage-transitions' }, transitions) : null,
        ]);
    }

    async function runTransition(button, event, stage, transition) {
        button.disabled = true;

        try {
            await api.transition(event.id, stage.name, transition.name);
            toast(`${stage.name}: ${transition.name}`, 'good');
        } catch (error) {
            button.disabled = false;
            toast(error.message, 'error');
        }
    }

    async function cancelEvent(event) {
        const confirmed = await modal({
            title: 'Cancel this event?',
            body: el('p', { text: `${event.name} will stop immediately and everyone taking part goes back to spawn.` }),
            confirmLabel: 'Cancel event',
        });

        if (!confirmed) return;

        try {
            await api.cancelEvent(event.id);
            toast('Event cancelled.', 'good');
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    return { render };
}
