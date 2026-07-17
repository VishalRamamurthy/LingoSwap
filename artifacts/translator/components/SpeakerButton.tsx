import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Paths, File as FSFile } from "expo-file-system";
import { useTextToSpeech } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface SpeakerButtonProps {
  text: string;
  language?: string;
  size?: number;
}

export default function SpeakerButton({ text, language, size = 18 }: SpeakerButtonProps) {
  const colors = useColors();
  const ttsMutation = useTextToSpeech();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stop = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
  };

  const showError = (message: string) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      alert(message);
    } else {
      Alert.alert("Audio unavailable", message);
    }
  };

  const play = () => {
    if (isPlaying) {
      stop();
      return;
    }
    ttsMutation.mutate(
      { data: { text, language } },
      {
        onSuccess: async (data) => {
          try {
            let uri: string;
            if (Platform.OS === "web") {
              uri = `data:${data.mimeType};base64,${data.audioBase64}`;
            } else {
              // expo-file-system v19+ uses File/Paths API
              const file = new FSFile(Paths.cache, `tts-${Date.now()}.mp3`);
              const bytes = Uint8Array.from(atob(data.audioBase64), (c) =>
                c.charCodeAt(0)
              );
              await file.write(bytes);
              uri = file.uri;
            }
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
            const { sound } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: true }
            );
            soundRef.current = sound;
            setIsPlaying(true);
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                setIsPlaying(false);
                sound.unloadAsync().catch(() => {});
                soundRef.current = null;
              }
            });
          } catch {
            setIsPlaying(false);
            showError("Could not play the audio on this device.");
          }
        },
        onError: (err) => {
          showError(
            (err as Error | undefined)?.message ||
              "Could not generate audio right now. Please try again."
          );
        },
      }
    );
  };

  if (!text.trim()) return null;

  return (
    <TouchableOpacity
      onPress={play}
      style={{ padding: 6 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      disabled={ttsMutation.isPending}
    >
      {ttsMutation.isPending ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <Feather
          name={isPlaying ? "pause" : "volume-2"}
          size={size}
          color={isPlaying ? colors.accent : colors.mutedForeground}
        />
      )}
    </TouchableOpacity>
  );
}
