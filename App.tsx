import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { supabase } from './supabaseClient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CENTER_PADDING = SCREEN_WIDTH / 2;

export default function App() {
  const videoRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [clips, setClips] = useState([]);
  const [selectedVideoUri, setSelectedVideoUri] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [videoText, setVideoText] = useState('');
  const [isTextModalVisible, setIsTextModalVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [activeFilter, setActiveFilter] = useState('none');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // ── VIDEO PLAYER STATES ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── SCROLL TIMELINE ──
  const handleScroll = (event) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const calculatedTime = scrollX / 20;
    setCurrentTime(parseFloat(calculatedTime.toFixed(1)));
  };

  // ── IMPORT VIDEO ──
  const pickVideoFromGallery = async () => {
    const result = await launchImageLibrary({
      mediaType: 'video',
      videoQuality: 'high',
    });

    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const videoAsset = result.assets[0];
      const durationSec = videoAsset.duration
        ? parseFloat(videoAsset.duration.toFixed(1))
        : 0;
      setSelectedVideoUri(videoAsset.uri);
      setClips([{ id: '1', title: 'Clip 1', duration: durationSec }]);
      setCurrentTime(0);
      setIsPlaying(false);
      setVideoProgress(0);
    }
  };

  // ── VIDEO PLAYER EVENTS ──
  const handleVideoLoad = (data) => {
    setVideoDuration(data.duration);
    setIsVideoLoading(false);
  };

  const handleVideoProgress = (data) => {
    setVideoProgress(data.currentTime);
    setCurrentTime(parseFloat(data.currentTime.toFixed(1)));
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setVideoProgress(0);
    videoRef.current?.seek(0);
  };

  const handleVideoError = (error) => {
    setIsVideoLoading(false);
    Alert.alert('Video error', 'Could not play this video.');
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (seconds) => {
    const newTime = Math.max(0, Math.min(videoProgress + seconds, videoDuration));
    videoRef.current?.seek(newTime);
    setVideoProgress(newTime);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0;

  // ── SPLIT CLIP ──
  const handleSplitClip = () => {
    if (clips.length === 0) {
      Alert.alert('Action not possible', 'Please import a video first.');
      return;
    }
    let timeAccumulator = 0;
    let clipToSplitIndex = -1;
    for (let i = 0; i < clips.length; i += 1) {
      timeAccumulator += clips[i].duration;
      if (currentTime <= timeAccumulator) {
        clipToSplitIndex = i;
        break;
      }
    }
    if (clipToSplitIndex !== -1) {
      const targetClip = clips[clipToSplitIndex];
      const previousClipsDuration = timeAccumulator - targetClip.duration;
      const splitPointInClip = currentTime - previousClipsDuration;
      if (splitPointInClip > 0.2 && splitPointInClip < targetClip.duration - 0.2) {
        const firstPart = {
          id: `${Date.now()}-a`,
          title: `${targetClip.title} (A)`,
          duration: parseFloat(splitPointInClip.toFixed(1)),
        };
        const secondPart = {
          id: `${Date.now()}-b`,
          title: `${targetClip.title} (B)`,
          duration: parseFloat((targetClip.duration - splitPointInClip).toFixed(1)),
        };
        const updatedClips = [...clips];
        updatedClips.splice(clipToSplitIndex, 1, firstPart, secondPart);
        setClips(updatedClips);
        Alert.alert('Split complete', 'Your clip has been split into two parts.');
      } else {
        Alert.alert('Split impossible', 'Move the timeline slightly away from the edges.');
      }
    }
  };

  // ── DELETE CLIP ──
  const handleDeleteSelected = () => {
    if (clips.length === 0) {
      Alert.alert('Action not possible', 'There are no clips to delete.');
      return;
    }
    let timeAccumulator = 0;
    let clipToDeleteIndex = -1;
    for (let i = 0; i < clips.length; i += 1) {
      timeAccumulator += clips[i].duration;
      if (currentTime <= timeAccumulator) {
        clipToDeleteIndex = i;
        break;
      }
    }
    if (clipToDeleteIndex !== -1) {
      const targetClip = clips[clipToDeleteIndex];
      Alert.alert(
        'Delete clip',
        `Remove "${targetClip.title}" from the timeline?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const updatedClips = clips.filter((_, index) => index !== clipToDeleteIndex);
              setClips(updatedClips);
              if (updatedClips.length === 0) {
                setSelectedVideoUri('');
                setVideoText('');
                setIsPlaying(false);
              }
            },
          },
        ]
      );
    }
  };

  const confirmDeleteClip = (clipId, clipTitle) => {
    Alert.alert(
      'Delete clip',
      `Delete ${clipTitle} from the timeline?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => setClips((prev) => prev.filter((c) => c.id !== clipId)),
        },
      ]
    );
  };

  // ── LOAD TEMPLATES ──
  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('id, title, description, thumbnail_url, video_url, duration')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      Alert.alert('Error', 'Could not load templates: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const openTemplateModal = () => {
    setIsTemplateModalVisible(true);
    loadTemplates();
  };

  // ── USE TEMPLATE ──
  const handleUseTemplate = (template) => {
    Alert.alert(
      'Use this template',
      `Load "${template.title}" into your timeline?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use template',
          onPress: () => {
            setSelectedVideoUri(template.video_url);
            setClips([{
              id: `template-${template.id}`,
              title: template.title,
              duration: template.duration || 10,
            }]);
            setCurrentTime(0);
            setActiveFilter('none');
            setVideoText('');
            setIsPlaying(false);
            setIsTemplateModalVisible(false);
            Alert.alert('Template loaded!', 'You can now edit it with your own clips.');
          },
        },
      ]
    );
  };

  // ── PERMISSIONS ──
  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 33) return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  // ── EXPORT ──
  const handleExport = async () => {
    if (!selectedVideoUri) {
      Alert.alert('Nothing to export', 'Add a video to the timeline first.');
      return;
    }
    Alert.alert(
      'Export',
      'What do you want to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save to gallery', onPress: handleSaveToGallery },
        { text: 'Share (TikTok, WhatsApp...)', onPress: handleShareVideo },
      ]
    );
  };

  const handleSaveToGallery = async () => {
    setIsExporting(true);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission required', 'Please allow storage access.');
        return;
      }
      await CameraRoll.save(selectedVideoUri, { type: 'video' });
      Alert.alert('Saved!', 'Your video has been saved to your gallery.');
    } catch (err) {
      Alert.alert('Error', 'Could not save video: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareVideo = async () => {
    setIsExporting(true);
    try {
      await Share.open({
        url: selectedVideoUri,
        type: 'video/mp4',
        title: 'Share your video',
      });
    } catch (err) {
      if (err.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share: ' + (err.message || 'Unknown error'));
      }
    } finally {
      setIsExporting(false);
    }
  };

  // ── SAVE TO CLOUD ──
  const saveProjectToCloud = async () => {
    if (!selectedVideoUri) {
      Alert.alert('Save impossible', 'Add a video to the timeline first.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('projects').insert([{
        title: 'My CapCut Project',
        timeline_data: {
          video_uri: selectedVideoUri,
          video_clips_count: clips.length,
          last_pointer_position: currentTime,
          applied_text: videoText,
          applied_filter: activeFilter,
        },
      }]);
      if (error) throw error;
      Alert.alert('Saved', 'The project was saved to Supabase.');
    } catch (err) {
      Alert.alert('Cloud error', err.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyText = () => {
    setVideoText(inputText);
    setIsTextModalVisible(false);
  };

  const applyFilter = (filterName) => {
    setActiveFilter(filterName);
    setIsFilterModalVisible(false);
  };

  const totalDuration = parseFloat(
    clips.reduce((acc, clip) => acc + clip.duration, 0).toFixed(1)
  );

  const getFilterStyle = () => {
    if (activeFilter === 'sepia') return { tintColor: 'rgba(210, 105, 30, 0.22)' };
    if (activeFilter === 'bw') return { opacity: 0.6 };
    return {};
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F0F" />

      {/* ── VIDEO PREVIEW ── */}
      <View style={styles.previewPlayer}>
        {selectedVideoUri ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: selectedVideoUri }}
              style={styles.videoPlayer}
              paused={!isPlaying}
              muted={isMuted}
              resizeMode="contain"
              onLoad={handleVideoLoad}
              onProgress={handleVideoProgress}
              onEnd={handleVideoEnd}
              onError={handleVideoError}
              onLoadStart={() => setIsVideoLoading(true)}
            />

            {/* Filter overlay */}
            {activeFilter === 'sepia' && <View style={styles.filterSepia} pointerEvents="none" />}
            {activeFilter === 'vintage' && <View style={styles.filterVintage} pointerEvents="none" />}
            {activeFilter === 'bw' && <View style={styles.filterBW} pointerEvents="none" />}

            {/* Loading spinner */}
            {isVideoLoading && (
              <ActivityIndicator size="large" color="#007FFF" style={styles.videoLoader} />
            )}

            {/* Floating text overlay */}
            {videoText ? (
              <View style={styles.floatingTextContainer}>
                <Text style={styles.floatingText}>{videoText}</Text>
              </View>
            ) : null}

            {/* Play/Pause center button */}
            <TouchableOpacity style={styles.playPauseOverlay} onPress={togglePlayPause} activeOpacity={0.7}>
              {!isPlaying && (
                <View style={styles.playIconCircle}>
                  <Icon name="play" size={30} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Bottom controls */}
            <View style={styles.videoControls}>
              <TouchableOpacity onPress={() => handleSeek(-5)} style={styles.seekBtn}>
                <Icon name="play-back" size={18} color="#fff" />
                <Text style={styles.seekText}>5s</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn}>
                <Icon name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleSeek(5)} style={styles.seekBtn}>
                <Icon name="play-forward" size={18} color="#fff" />
                <Text style={styles.seekText}>5s</Text>
              </TouchableOpacity>

              <Text style={styles.videoTime}>
                {formatTime(videoProgress)} / {formatTime(videoDuration)}
              </Text>

              <TouchableOpacity onPress={() => setIsMuted((m) => !m)} style={styles.muteBtn}>
                <Icon name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>

          </>
        ) : (
          <TouchableOpacity style={styles.emptyPreview} onPress={pickVideoFromGallery}>
            <Icon name="videocam-outline" size={48} color="#444" />
            <Text style={styles.emptyPreviewText}>Tap to import a video</Text>
          </TouchableOpacity>
        )}

        {/* Cloud save button */}
        <TouchableOpacity style={styles.cloudButton} onPress={saveProjectToCloud} disabled={isSaving}>
          {isSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="cloud-upload" size={18} color="#fff" />}
        </TouchableOpacity>

        {/* Export button */}
        <TouchableOpacity style={styles.exportButton} onPress={handleExport} disabled={isExporting}>
          {isExporting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Icon name="share-social" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* ── TOOLBAR ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarScroll}>
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolButton} onPress={pickVideoFromGallery}>
            <MCIcon name="video-plus" size={22} color="#007FFF" />
            <Text style={[styles.toolText, { color: '#007FFF' }]}>Import</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleSplitClip}>
            <MCIcon name="content-cut" size={22} color="#EF4444" />
            <Text style={[styles.toolText, { color: '#EF4444' }]}>Split</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleDeleteSelected}>
            <MCIcon name="trash-can-outline" size={22} color="#EF4444" />
            <Text style={[styles.toolText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={() => setIsTextModalVisible(true)}>
            <MCIcon name="text" size={22} color="#22C55E" />
            <Text style={[styles.toolText, { color: '#22C55E' }]}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={() => setIsFilterModalVisible(true)}>
            <Icon name="color-filter" size={22} color="#EAB308" />
            <Text style={[styles.toolText, { color: '#EAB308' }]}>Filter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={openTemplateModal}>
            <MCIcon name="star-four-points-outline" size={22} color="#A855F7" />
            <Text style={[styles.toolText, { color: '#A855F7' }]}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={handleExport} disabled={isExporting}>
            <Icon name="download-outline" size={22} color="#F97316" />
            <Text style={[styles.toolText, { color: '#F97316' }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── TIMELINE ── */}
      <View style={styles.timelineContainer}>
        <View style={styles.playhead} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          contentContainerStyle={[styles.scrollTimeline, { paddingHorizontal: CENTER_PADDING }]}
        >
          <View style={{ flexDirection: 'column', justifyContent: 'center' }}>
            <View style={styles.track}>
              {clips.length > 0 ? (
                clips.map((clip) => (
                  <TouchableOpacity
                    key={clip.id}
                    style={[styles.clip, { width: Math.max(clip.duration * 20, 80), backgroundColor: '#007FFF' }]}
                    activeOpacity={0.85}
                    onLongPress={() => confirmDeleteClip(clip.id, clip.title)}
                  >
                    <Text style={styles.clipText} numberOfLines={1}>
                      {clip.title} ({clip.duration}s)
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity
                  style={[styles.clip, { width: 180, backgroundColor: '#333' }]}
                  onPress={pickVideoFromGallery}
                >
                  <Text style={[styles.clipText, { color: '#aaa' }]}>Add a video</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.track}>
              <View style={[styles.audioClip, { width: 140, marginLeft: 10 }]}>
                <Text style={styles.clipText}>Ambient_Audio.mp3</Text>
              </View>
            </View>
          </View>
        </ScrollView>
        <Text style={styles.hintText}>Long press any blue clip to delete it.</Text>
      </View>

      {/* ── TEMPLATES MODAL ── */}
      <Modal visible={isTemplateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Templates</Text>
              <TouchableOpacity onPress={() => setIsTemplateModalVisible(false)}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {isLoadingTemplates ? (
              <ActivityIndicator size="large" color="#A855F7" style={{ marginVertical: 30 }} />
            ) : templates.length === 0 ? (
              <View style={styles.emptyState}>
                <MCIcon name="video-off-outline" size={48} color="#555" />
                <Text style={styles.emptyStateText}>No templates found.</Text>
                <Text style={styles.emptyStateSubText}>Add rows to your "templates" table in Supabase.</Text>
              </View>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.templateCard}>
                    {item.thumbnail_url ? (
                      <Image source={{ uri: item.thumbnail_url }} style={styles.templateThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={[styles.templateThumbnail, styles.templateThumbnailPlaceholder]}>
                        <Icon name="videocam-outline" size={28} color="#555" />
                      </View>
                    )}
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.templateDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                      <Text style={styles.templateDuration}>{item.duration ? `${item.duration}s` : '—'}</Text>
                    </View>
                    <TouchableOpacity style={styles.useTemplateBtn} onPress={() => handleUseTemplate(item)}>
                      <Text style={styles.useTemplateBtnText}>Use</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── TEXT MODAL ── */}
      <Modal visible={isTextModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add text to the video</Text>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type text here..."
              placeholderTextColor="#AAA"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsTextModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleApplyText}>
                <Text style={styles.btnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── FILTER MODAL ── */}
      <Modal visible={isFilterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBottomContent}>
            <Text style={styles.modalTitle}>Filters</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 15 }}>
              {['none', 'sepia', 'vintage', 'bw'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterCard, activeFilter === f && styles.filterActive]}
                  onPress={() => applyFilter(f)}
                >
                  <Text style={styles.filterCardText}>
                    {f === 'none' ? 'Normal' : f === 'bw' ? 'B/W' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsFilterModalVisible(false)}>
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },

  // ── PREVIEW ──
  previewPlayer: { height: '40%', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  videoPlayer: { width: '100%', height: '100%' },
  videoLoader: { position: 'absolute', zIndex: 20 },
  emptyPreview: { justifyContent: 'center', alignItems: 'center' },
  emptyPreviewText: { color: '#555', fontSize: 13, marginTop: 8 },

  // ── FILTER OVERLAYS ──
  filterSepia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(210, 105, 30, 0.22)', zIndex: 2 },
  filterVintage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(245, 222, 179, 0.18)', zIndex: 2 },
  filterBW: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2 },

  // ── VIDEO CONTROLS ──
  playPauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 40, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  playIconCircle: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 35, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', paddingLeft: 4 },
  videoControls: { position: 'absolute', bottom: 22, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, zIndex: 10 },
  seekBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  seekText: { color: '#fff', fontSize: 10, marginLeft: 2 },
  playPauseBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  videoTime: { flex: 1, color: '#fff', fontSize: 11, textAlign: 'center' },
  muteBtn: { paddingHorizontal: 8 },
  progressBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 10 },
  progressBarFill: { height: 3, backgroundColor: '#007FFF' },

  // ── FLOATING TEXT ──
  floatingTextContainer: { position: 'absolute', bottom: '35%', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, zIndex: 8 },
  floatingText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },

  // ── TOP BUTTONS ──
  cloudButton: { position: 'absolute', top: 10, left: 10, backgroundColor: '#22C55E', padding: 7, borderRadius: 18, zIndex: 12 },
  exportButton: { position: 'absolute', top: 10, right: 10, backgroundColor: '#F97316', padding: 7, borderRadius: 18, zIndex: 12 },

  // ── TOOLBAR ──
  toolbarScroll: { backgroundColor: '#161618', borderBottomWidth: 1, borderBottomColor: '#222', maxHeight: 70 },
  toolbar: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8 },
  toolButton: { alignItems: 'center', paddingHorizontal: 14 },
  toolText: { color: '#fff', fontSize: 10, marginTop: 3 },

  // ── TIMELINE ──
  timelineContainer: { flex: 1, backgroundColor: '#111113', position: 'relative', justifyContent: 'center' },
  playhead: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: '#007FFF', zIndex: 10, marginLeft: -1 },
  scrollTimeline: { alignItems: 'center' },
  track: { flexDirection: 'row', height: 60, alignItems: 'center', marginVertical: 5 },
  clip: { height: 50, borderRadius: 6, borderWidth: 1, borderColor: '#007FFF', justifyContent: 'center', paddingLeft: 10, marginRight: 4 },
  audioClip: { height: 35, backgroundColor: '#1E3A8A', borderRadius: 4, justifyContent: 'center', paddingLeft: 10 },
  clipText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  hintText: { color: '#A0A0A0', fontSize: 12, textAlign: 'center', marginTop: 10 },

  // ── MODALS ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalContent: { width: '90%', backgroundColor: '#1C1C1E', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  textInput: { backgroundColor: '#2C2C2E', color: '#FFF', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 20, marginTop: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { flex: 0.48, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#3A3A3C' },
  saveBtn: { backgroundColor: '#22C55E' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  modalBottomContent: { width: '85%', backgroundColor: '#1C1C1E', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
  filterCard: { backgroundColor: '#2C2C2E', paddingHorizontal: 16, paddingVertical: 20, borderRadius: 8, marginRight: 10, minWidth: 90, alignItems: 'center' },
  filterActive: { borderColor: '#EAB308', borderWidth: 2 },
  filterCardText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // ── TEMPLATES ──
  templateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C2C2E', borderRadius: 10, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  templateThumbnail: { width: 90, height: 70, backgroundColor: '#1a1a1a' },
  templateThumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  templateInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 8 },
  templateTitle: { color: '#FFF', fontSize: 13, fontWeight: '600', marginBottom: 3 },
  templateDesc: { color: '#AAA', fontSize: 11, marginBottom: 3 },
  templateDuration: { color: '#A855F7', fontSize: 11, fontWeight: '500' },
  useTemplateBtn: { backgroundColor: '#A855F7', paddingHorizontal: 14, paddingVertical: 8, marginRight: 10, borderRadius: 8 },
  useTemplateBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 30 },
  emptyStateText: { color: '#AAA', fontSize: 14, marginTop: 12, fontWeight: '500' },
  emptyStateSubText: { color: '#666', fontSize: 12, marginTop: 6, textAlign: 'center' },
});