/** Decode browser audio and encode a portable mono 16 kHz, 16-bit PCM WAV. */
export async function encodeDictationWav(blob) {
    const context = new OfflineAudioContext(1, 1, 16000);
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (!audio.length || audio.duration > 120) throw new Error('Choose audio up to 120 seconds long.');
    const bytes = new ArrayBuffer(44 + audio.length * 2);
    const view = new DataView(bytes);
    const text = (offset, value) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, bytes.byteLength - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, audio.length * 2, true);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, channel) => audio.getChannelData(channel));
    for (let index = 0; index < audio.length; index++) {
        const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[index], 0) / channels.length));
        view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    return new File([bytes], 'dictation.wav', { type: 'audio/wav' });
}
