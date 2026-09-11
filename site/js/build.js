import { api } from './api.js';
import { byId, el, empty, replace, toast } from './dom.js';

export function createBuildPane(ctx) {
    const nameInput = byId('build-name');
    const fileInput = byId('build-file');
    const stageList = byId('stage-list');
    const palette = byId('stage-palette');
    const preview = byId('build-preview');
    const message = byId('build-message');
    const saveButton = byId('build-save');

    let draft = emptyDraft();
    let fileTouched = false;

    nameInput.addEventListener('input', () => {
        draft.name = nameInput.value;

        if (!fileTouched) fileInput.value = slug(draft.name);
    });

    fileInput.addEventListener('input', () => {
        fileTouched = true;
    });

    byId('build-reset').addEventListener('click', () => {
        draft = emptyDraft();
        fileTouched = false;
        nameInput.value = '';
        fileInput.value = '';
        preview.textContent = 'Nothing saved yet.';
        setMessage('');
        render();
    });

    saveButton.addEventListener('click', save);

    function emptyDraft() {
        return { name: '', stages: [] };
    }

    function slug(value) {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48);
    }

    function schemas() {
        return ctx.getBootstrap()?.stages ?? [];
    }

    function schemaFor(type) {
        return schemas().find((schema) => schema.type === type) ?? null;
    }

    function setMessage(text, kind = '') {
        message.textContent = text;
        message.className = `message ${kind ? `is-${kind}` : ''}`;
    }

    function render() {
        renderPalette();
        renderStages();
    }

    function renderPalette() {
        const available = schemas();

        if (available.length === 0) {
            replace(palette, el('span', { class: 'palette-label', text: 'This server has no stages the panel can configure.' }));
            return;
        }

        replace(palette, [
            el('span', { class: 'palette-label', text: 'Add a stage:' }),
            ...available.map((schema) =>
                el('button', {
                    class: 'button button-small',
                    text: schema.label,
                    title: schema.description,
                    onClick: () => addStage(schema),
                })
            ),
        ]);
    }

    function renderStages() {
        if (draft.stages.length === 0) {
            replace(stageList, empty('No stages yet. Add one below to get started.'));
            return;
        }

        replace(stageList, draft.stages.map(stageCard));
    }

    function stageCard(stage, index) {
        const schema = schemaFor(stage.type);

        return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
                el('span', { class: 'stage-index', text: String(index + 1) }),
                el('div', {}, [
                    el('h3', { class: 'card-title', text: schema?.label ?? stage.type }),
                    el('p', { class: 'card-sub', text: stage.type }),
                ]),
                el('div', { class: 'card-actions' }, [
                    el('button', {
                        class: 'button button-small',
                        text: 'Up',
                        disabled: index === 0,
                        onClick: () => move(index, -1),
                    }),
                    el('button', {
                        class: 'button button-small',
                        text: 'Down',
                        disabled: index === draft.stages.length - 1,
                        onClick: () => move(index, 1),
                    }),
                    el('button', {
                        class: 'button button-danger button-small',
                        text: 'Remove',
                        onClick: () => remove(index),
                    }),
                ]),
            ]),

            el('div', { style: 'margin-top:12px' }, [
                el('label', { class: 'field' }, [
                    el('span', { class: 'field-label', text: 'Stage name' }),
                    el('input', {
                        type: 'text',
                        value: stage.name,
                        placeholder: schema?.label ?? 'Stage',
                        onInput: (event) => { stage.name = event.currentTarget.value; },
                    }),
                    el('span', {
                        class: 'field-hint',
                        text: 'How you will refer to it while the event runs. Must be unique within the event.',
                    }),
                ]),

                schema
                    ? el('div', { class: 'field-grid' }, schema.options.map((option) => optionField(stage, option)))
                    : el('p', { class: 'field-hint', text: 'This server no longer offers this stage type.' }),
            ]),
        ]);
    }

    function optionField(stage, option) {
        const value = stage.options[option.name];

        return el('label', { class: 'field' }, [
            el('span', { class: 'field-label', text: option.label + (option.required ? ' *' : '') }),
            optionInput(stage, option, value),
            option.description ? el('span', { class: 'field-hint', text: option.description }) : null,
        ]);
    }

    function optionInput(stage, option, value) {
        if (option.type === 'boolean') {
            return el('input', {
                type: 'checkbox',
                checked: Boolean(value),
                onChange: (event) => { stage.options[option.name] = event.currentTarget.checked; },
            });
        }

        if (option.type === 'number') {
            return el('input', {
                type: 'number',
                value: value ?? option.default ?? 0,
                min: option.min ?? undefined,
                max: option.max ?? undefined,
                onInput: (event) => {
                    const parsed = Number(event.currentTarget.value);
                    stage.options[option.name] = Number.isFinite(parsed) ? parsed : null;
                },
            });
        }

        if (option.type === 'track') {
            const tracks = ctx.getBootstrap()?.tracks ?? [];

            const options = tracks.includes(value) || !value ? tracks : [value, ...tracks];

            const select = el('select', {
                onChange: (event) => { stage.options[option.name] = event.currentTarget.value; },
            }, [
                el('option', { value: '', text: tracks.length ? 'Choose a track' : 'No tracks loaded' }),
                ...options.map((track) => el('option', { value: track, text: track })),
            ]);

            select.value = value ?? '';

            return select;
        }

        return el('input', {
            type: 'text',
            value: value ?? option.default ?? '',
            onInput: (event) => { stage.options[option.name] = event.currentTarget.value; },
        });
    }

    function addStage(schema) {
        const options = {};

        for (const option of schema.options) {
            if (option.default !== null && option.default !== undefined) options[option.name] = option.default;
        }

        draft.stages.push({
            type: schema.type,
            name: uniqueName(schema.label),
            options,
        });

        renderStages();
    }

    function uniqueName(base) {
        const taken = new Set(draft.stages.map((stage) => stage.name));

        if (!taken.has(base)) return base;

        let counter = 2;
        while (taken.has(`${base} ${counter}`)) counter += 1;

        return `${base} ${counter}`;
    }

    function move(index, delta) {
        const target = index + delta;

        if (target < 0 || target >= draft.stages.length) return;

        [draft.stages[index], draft.stages[target]] = [draft.stages[target], draft.stages[index]];

        renderStages();
    }

    function remove(index) {
        draft.stages.splice(index, 1);
        renderStages();
    }

    async function save() {
        const file = fileInput.value.trim();

        if (!draft.name.trim()) {
            setMessage('Give the event a display name.', 'error');
            return;
        }

        if (!file) {
            setMessage('Give the event a file name.', 'error');
            return;
        }

        if (draft.stages.length === 0) {
            setMessage('An event needs at least one stage.', 'error');
            return;
        }

        const names = draft.stages.map((stage) => stage.name.trim());

        if (names.some((name) => !name)) {
            setMessage('Every stage needs a name.', 'error');
            return;
        }

        if (new Set(names).size !== names.length) {
            setMessage('Two stages share a name. Stage names are how you address them while running.', 'error');
            return;
        }

        saveButton.disabled = true;
        setMessage('Saving…');

        try {
            const saved = await api.saveDefinition(file, {
                name: draft.name.trim(),
                stages: draft.stages.map((stage) => ({
                    type: stage.type,
                    name: stage.name.trim(),
                    options: stage.options,
                })),
            });

            preview.textContent = saved.source ?? '';
            setMessage(`Saved as ${saved.name}.`, 'good');

            await ctx.refreshBootstrap();
        } catch (error) {
            setMessage(error.message, 'error');
        } finally {
            saveButton.disabled = false;
        }
    }

    async function open(definition) {
        draft = {
            name: definition.document?.name ?? definition.title ?? '',
            stages: (definition.document?.stages ?? []).map((stage) => ({
                type: stage.type,
                name: stage.name,
                options: { ...stage.options },
            })),
        };

        nameInput.value = draft.name;
        fileInput.value = definition.name;
        fileTouched = true;

        setMessage(`Editing ${definition.name}.`);
        render();

        try {
            const full = await api.readDefinition(definition.name);
            preview.textContent = full.source ?? '';
        } catch (error) {
            preview.textContent = 'Could not read the file from the server.';
            toast(error.message, 'error');
        }
    }

    return { render, open };
}
