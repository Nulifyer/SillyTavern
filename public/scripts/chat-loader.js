// Character and group loads share one foreground lifetime. Read failures never
// become empty conversations, and obsolete requests cannot replace a newer story.
let activeLoad;

export async function readChatFile(url, body, headers, signal, { allowHeaderless = false } = {}) {
    const response = await fetch(url, { method: 'POST', headers, cache: 'no-cache', body: JSON.stringify(body), signal });
    if (!response.ok) throw new Error('Chat could not be loaded. Your existing conversation has not been replaced.');
    const data = await response.json();
    if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item)
        || (item.chat_metadata != null && (typeof item.chat_metadata !== 'object' || Array.isArray(item.chat_metadata))))) {
        throw new Error('The server returned invalid chat data. Your existing conversation has not been replaced.');
    }
    const header = data[0];
    const hasHeader = header && ['chat_metadata', 'user_name', 'character_name', 'create_date'].some(key => Object.hasOwn(header, key));
    if ((data.length && !hasHeader && !allowHeaderless) || data.slice(hasHeader ? 1 : 0).some(message => typeof message.mes !== 'string')) {
        throw new Error('The server returned an invalid chat file. Your existing conversation has not been replaced.');
    }
    return data;
}

export function cancelChatLoad() {
    activeLoad?.abort();
    activeLoad = undefined;
}

export function beginChatLoad() {
    cancelChatLoad();
    const controller = activeLoad = new AbortController();
    return {
        isCurrent: () => activeLoad === controller && !controller.signal.aborted,
        async read(url, body, headers, options) {
            return readChatFile(url, body, headers, controller.signal, options);
        },
    };
}
