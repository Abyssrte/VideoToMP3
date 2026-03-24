import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import {pick, types} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import {FFmpegKit, ReturnCode} from 'ffmpeg-kit-react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';

type Status = 'idle' | 'converting' | 'done' | 'error';

const BITRATES = ['128', '192', '256', '320'];
const SAMPLE_RATES = ['22050', '44100', '48000'];

export default function App() {
  const [file, setFile] = useState<any>(null);
  const [bitrate, setBitrate] = useState('192');
  const [sampleRate, setSampleRate] = useState('44100');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [outputPath, setOutputPath] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const perm =
      Number(Platform.Version) >= 33
        ? PERMISSIONS.ANDROID.READ_MEDIA_VIDEO
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
    const result = await check(perm);
    if (result === RESULTS.GRANTED) return true;
    const req = await request(perm);
    return req === RESULTS.GRANTED;
  };

  const pickFile = async () => {
    try {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission denied', 'Storage permission chahiye file pick karne ke liye');
        return;
      }
      const [res] = await pick({type: [types.video, types.audio]});
      setFile(res);
      setStatus('idle');
      setOutputPath('');
      setErrorMsg('');
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) {
        Alert.alert('Error', 'File pick nahi hui: ' + e.message);
      }
    }
  };

  const convert = async () => {
    if (!file) return;
    setStatus('converting');
    setProgress(0);
    setErrorMsg('');

    try {
      const inputPath = file.uri.replace('file://', '');
      const outputName = file.name.replace(/\.[^.]+$/, '') + '.mp3';
      const outputDir = RNFS.DownloadDirectoryPath;
      const outPath = `${outputDir}/${outputName}`;

      // Delete if exists
      const exists = await RNFS.exists(outPath);
      if (exists) await RNFS.unlink(outPath);

      const cmd = `-i "${inputPath}" -vn -ar ${sampleRate} -ac 2 -b:a ${bitrate}k "${outPath}"`;

      setProgress(10);

      await FFmpegKit.executeAsync(
        cmd,
        async session => {
          const returnCode = await session.getReturnCode();
          if (ReturnCode.isSuccess(returnCode)) {
            setOutputPath(outPath);
            setProgress(100);
            setStatus('done');
          } else {
            const logs = await session.getLogsAsString();
            setErrorMsg('FFmpeg error: ' + logs.slice(-300));
            setStatus('error');
          }
        },
        _log => {},
        stats => {
          if (stats) {
            const time = stats.getTime();
            if (time > 0) {
              setProgress(Math.min(90, 10 + Math.floor(time / 100)));
            }
          }
        },
      );
    } catch (e: any) {
      setErrorMsg('Error: ' + e.message);
      setStatus('error');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isConverting = status === 'converting';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTag}>⎯⎯ AUDIO EXTRACTOR</Text>
          <Text style={s.title}>VIDEO{'\n'}TO <Text style={s.accent}>MP3</Text></Text>
          <Text style={s.subtitle}>// native · offline · fast</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <View style={s.cardAccentLine} />

          {/* File Picker */}
          <TouchableOpacity style={s.dropZone} onPress={pickFile} disabled={isConverting}>
            <Text style={s.dropIcon}>🎬</Text>
            <Text style={s.dropTitle}>
              {file ? file.name : 'Video select karo'}
            </Text>
            <Text style={s.dropSub}>
              {file
                ? formatSize(file.size)
                : 'TAP TO BROWSE · MP4 · MKV · AVI · MOV'}
            </Text>
          </TouchableOpacity>

          {/* Settings */}
          <View style={s.settingsRow}>
            {/* Bitrate */}
            <View style={s.settingBox}>
              <Text style={s.settingLabel}>BITRATE</Text>
              <View style={s.pills}>
                {BITRATES.map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[s.pill, bitrate === b && s.pillActive]}
                    onPress={() => setBitrate(b)}
                    disabled={isConverting}>
                    <Text style={[s.pillText, bitrate === b && s.pillTextActive]}>
                      {b}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sample Rate */}
            <View style={s.settingBox}>
              <Text style={s.settingLabel}>SAMPLE RATE</Text>
              <View style={s.pills}>
                {SAMPLE_RATES.map(sr => (
                  <TouchableOpacity
                    key={sr}
                    style={[s.pill, sampleRate === sr && s.pillActive]}
                    onPress={() => setSampleRate(sr)}
                    disabled={isConverting}>
                    <Text style={[s.pillText, sampleRate === sr && s.pillTextActive]}>
                      {sr === '22050' ? '22k' : sr === '44100' ? '44k' : '48k'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Convert Button */}
          <TouchableOpacity
            style={[s.convertBtn, (!file || isConverting || status === 'done') && s.convertBtnDisabled]}
            onPress={convert}
            disabled={!file || isConverting || status === 'done'}>
            {isConverting ? (
              <View style={s.convertBtnInner}>
                <ActivityIndicator color="#fff" size="small" style={{marginRight: 8}} />
                <Text style={s.convertBtnText}>CONVERTING... {progress}%</Text>
              </View>
            ) : (
              <Text style={s.convertBtnText}>
                {status === 'done' ? '✓ CONVERTED' : '→ CONVERT TO MP3'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Progress Bar */}
          {isConverting && (
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, {width: `${progress}%`}]} />
              </View>
            </View>
          )}

          {/* Success */}
          {status === 'done' && outputPath !== '' && (
            <View style={s.successBox}>
              <Text style={s.successTitle}>✓ Conversion Complete!</Text>
              <Text style={s.successSub}>Saved to Downloads folder</Text>
              <Text style={s.successPath} numberOfLines={2}>{outputPath}</Text>
            </View>
          )}

          {/* Error */}
          {status === 'error' && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>⚠ {errorMsg}</Text>
            </View>
          )}

          {/* Reset */}
          {(file || status !== 'idle') && (
            <TouchableOpacity
              style={s.resetBtn}
              onPress={() => {
                setFile(null);
                setStatus('idle');
                setProgress(0);
                setOutputPath('');
                setErrorMsg('');
              }}>
              <Text style={s.resetText}>reset / new file</Text>
            </TouchableOpacity>
          )}

          {/* Note */}
          <View style={s.note}>
            <Text style={s.noteText}>✦ File directly Downloads mein save hogi</Text>
            <Text style={s.noteText}>✦ Conversion offline hoti hai — no internet needed</Text>
            <Text style={s.noteText}>✦ Large files mein time lag sakta hai</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0a0a0a'},
  scroll: {padding: 20, paddingTop: 50, paddingBottom: 40},
  header: {marginBottom: 24},
  headerTag: {
    fontSize: 10,
    letterSpacing: 3,
    color: '#ff4500',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#f0f0f0',
    lineHeight: 44,
    letterSpacing: -1,
  },
  accent: {color: '#ff4500'},
  subtitle: {fontSize: 11, color: '#444', fontFamily: 'monospace', marginTop: 4},
  card: {
    backgroundColor: '#111',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
    padding: 20,
    overflow: 'hidden',
  },
  cardAccentLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: '#ff4500',
  },
  dropZone: {
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 28,
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
    marginBottom: 20,
  },
  dropIcon: {fontSize: 36, marginBottom: 10},
  dropTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ccc',
    marginBottom: 4,
    textAlign: 'center',
  },
  dropSub: {
    fontSize: 10,
    color: '#444',
    letterSpacing: 1,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  settingsRow: {marginBottom: 20, gap: 16},
  settingBox: {},
  settingLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#555',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  pills: {flexDirection: 'row', gap: 8},
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0d0d0d',
  },
  pillActive: {borderColor: '#ff4500', backgroundColor: 'rgba(255,69,0,0.1)'},
  pillText: {fontSize: 11, color: '#444', fontFamily: 'monospace'},
  pillTextActive: {color: '#ff4500', fontWeight: '700'},
  convertBtn: {
    backgroundColor: '#ff4500',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  convertBtnDisabled: {backgroundColor: '#1e1e1e'},
  convertBtnInner: {flexDirection: 'row', alignItems: 'center'},
  convertBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  progressWrap: {marginBottom: 16},
  progressBg: {height: 2, backgroundColor: '#1e1e1e', borderRadius: 2},
  progressFill: {height: 2, backgroundColor: '#ff4500', borderRadius: 2},
  successBox: {
    padding: 16,
    backgroundColor: 'rgba(255,69,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,0,0.2)',
    borderRadius: 4,
    marginBottom: 16,
  },
  successTitle: {fontSize: 14, fontWeight: '700', color: '#ff4500', marginBottom: 4},
  successSub: {fontSize: 11, color: '#555', marginBottom: 6},
  successPath: {fontSize: 10, color: '#444', fontFamily: 'monospace'},
  errorBox: {
    padding: 14,
    backgroundColor: 'rgba(255,30,30,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,30,30,0.2)',
    borderRadius: 4,
    marginBottom: 16,
  },
  errorText: {fontSize: 11, color: '#ff6060', fontFamily: 'monospace', lineHeight: 18},
  resetBtn: {alignItems: 'center', marginBottom: 16},
  resetText: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace',
    textDecorationLine: 'underline',
  },
  note: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 14,
    gap: 4,
  },
  noteText: {fontSize: 10, color: '#2a2a2a', fontFamily: 'monospace', lineHeight: 18},
});
