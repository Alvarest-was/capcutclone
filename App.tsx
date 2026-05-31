// REPARATION DU BUG PROTOCOL GETTER POUR REACT NATIVE 0.85+
if (typeof global.URL === 'function') {
  const OriginalURL = global.URL;
  global.URL = function(url, base) {
    const instance = new OriginalURL(url, base);
    // Force la réécriture de la propriété protocole demandée par Supabase
    Object.defineProperty(instance, 'protocol', {
      value: instance.protocol,
      writable: true,
      configurable: true
    });
    return instance;
  };
  global.URL.prototype = OriginalURL.prototype;
}
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1od29vbmVmdGxsdnhrbW9zaGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcwNzUsImV4cCI6MjA5NTI4MzA3NX0.LK3KeqcrYEJP9DZi4xfrvNUKlvXOD5PvFY15oG1bO_0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false, // Évite les conflits d'écriture de jetons sous Android pur
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

import React, { useState, useRef, useEffect } from 'react';
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1od29vbmVmdGxsdnhrbW9zaGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcwNzUsImV4cCI6MjA5NTI4MzA3NX0.LK3KeqcrYEJP9DZi4xfrvNUKlvXOD5PvFY15oG1bO_0';

// Initialisation directe dans le fichier pour couper court au bug d'import
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types
type Clip = { id: string; title: string; duration: number };
type Template = {
  id: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  duration?: number;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CENTER_PADDING = SCREEN_WIDTH / 2;

export default function App() {
  const videoRef = useRef<any>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedVideoUri, setSelectedVideoUri] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [videoText, setVideoText] = useState<string>('');
  const [isTextModalVisible, setIsTextModalVisible] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [activeTab, setActiveTab] = useState<string>('Éditer');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  // ÉTAT POUR LA RECHERCHE DE MODÈLES
  const [searchQuery, setSearchQuery] = useState('');
  // ÉTATS POUR LE LABO D'IA
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState<boolean>(false);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState<boolean>(false);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [selectedTemplateForView, setSelectedTemplateForView] = useState<Template | null>(null);
  const [isFullscreenPlayerVisible, setIsFullscreenPlayerVisible] = useState<boolean>(false);

  // ── VIDEO PLAYER STATES ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── SCROLL TIMELINE ──
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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
      setSelectedVideoUri(videoAsset.uri || '');
      setClips([{ id: '1', title: 'Clip 1', duration: durationSec }]);
      setCurrentTime(0);
      setIsPlaying(false);
      setVideoProgress(0);
    }
  };

  // ── VIDEO PLAYER EVENTS ──
  const handleVideoLoad = (data: any) => {
    setVideoDuration(data.duration);
    setIsVideoLoading(false);
  };

  const handleVideoProgress = (data: any) => {
    setVideoProgress(data.currentTime);
    setCurrentTime(parseFloat(data.currentTime.toFixed(1)));
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setVideoProgress(0);
    videoRef.current?.seek(0);
  };

  const handleVideoError = (error: any) => {
    setIsVideoLoading(false);
    Alert.alert('Video error', 'Could not play this video.');
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (seconds: number) => {
    const newTime = Math.max(0, Math.min(videoProgress + seconds, videoDuration));
    videoRef.current?.seek?.(newTime);
    setVideoProgress(newTime);
  };

  const formatTime = (seconds: number) => {
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
        const firstPart: Clip = {
          id: `${Date.now()}-a`,
          title: `${targetClip.title} (A)`,
          duration: parseFloat(splitPointInClip.toFixed(1)),
        };
        const secondPart: Clip = {
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

  const confirmDeleteClip = (clipId: string, clipTitle: string) => {
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
  const loadTemplates = async (category: string = 'Vie quotidienne') => {
    setIsLoadingTemplates(true);
    try {
      // Sécurité : si supabase n'est pas encore prêt, on force le mode secours directement
      if (!supabase) {
        throw new Error('Supabase client local introuvable');
      }

      let query = supabase
        .from('templates')
        .select('id, title, description, thumbnail_url, video_url, duration, category');

      if (category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates((data as Template[]) || []);
    } catch (err: any) {
      Alert.alert('Error', 'Could not load templates: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleSearchTemplates = async (text: string) => {
    setSearchQuery(text);
    setIsLoadingTemplates(true);
    
    try {
      let query = supabase
        .from('templates')
        .select('id, title, description, thumbnail_url, video_url, duration, category')
        .ilike('title', `%${text}%`);

      if (activeCategory !== 'Trending' && activeCategory !== 'Premium' && activeCategory !== 'Suivis') {
        query = query.eq('category', activeCategory);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates((data as Template[]) || []);
    } catch (err: any) {
      console.log('Erreur recherche Supabase, filtrage local de secours activé');
      
      if (!text.trim()) {
        loadTemplates(activeCategory);
        return;
      }
      
      setTemplates((prevTemplates) => 
        prevTemplates.filter((template) => 
          template.title?.toLowerCase().includes(text.toLowerCase())
        )
      );
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadUserProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserProjects(data || []);
    } catch (err: any) {
      console.log('Erreur de chargement des projets cloud : ', err.message);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleLoadProject = (project: any) => {
    const data = project.timeline_data;
    if (data) {
      setSelectedVideoUri(data.video_uri || '');
      setVideoText(data.applied_text || '');
      setActiveFilter(data.applied_filter || 'none');
      setCurrentTime(data.last_pointer_position || 0);
      
      const clipsCount = data.video_clips_count || 1;
      const durationEach = (data.video_duration || 15.0) / clipsCount;
      const reconstructedClips = Array.from({ length: clipsCount }, (_, i) => ({
        id: `cloud-${project.id}-${i}`,
        title: clipsCount > 1 ? `Clip 1 (${String.fromCharCode(65 + i)})` : `Clip 1`,
        duration: parseFloat(durationEach.toFixed(1))
      }));
      setClips(reconstructedClips);
      setActiveTab('Éditer');
      Alert.alert('Projet restauré ! 📂', 'Votre session de montage a été récupérée depuis le Cloud.');
    }
  };

  const handleDeleteProjectFromCloud = async (projectId: any) => {
    Alert.alert('Supprimer le projet 🗑️', 'Voulez-vous effacer définitivement ce brouillon de Supabase ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) throw error;
            setUserProjects((prev: any[]) => prev.filter((p: any) => p.id !== projectId));
            Alert.alert('Supprimé', 'Le projet a été retiré de votre espace cloud.');
          } catch (err: any) {
            Alert.alert('Erreur', err.message || 'Erreur inconnue');
          }
        }
      }
    ]);
  };

  useEffect(() => {
    if (activeTab === 'Projets') {
      loadUserProjects();
    }
  }, [activeTab]);

  const handleGenerateAIContent = () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Champ vide ⚠️', 'Veuillez décrire ce que vous souhaitez générer.');
      return;
    }
    
    setIsGeneratingAI(true);
    
    // Simulation du temps de calcul de l'Intelligence Artificielle
    setTimeout(() => {
      setIsGeneratingAI(false);
      setAiPrompt('');
      Alert.alert(
        'Génération réussie ! 🪄', 
        'Votre contenu généré par l\'IA est prêt et a été ajouté à vos fichiers locaux.'
      );
    }, 2500);
  };

  const openTemplateModal = () => {
    setIsTemplateModalVisible(true);
    loadTemplates(activeCategory);
  };

  const openFullscreenTemplate = (template: Template) => {
    setSelectedTemplateForView(template);
    setIsFullscreenPlayerVisible(true);
  };

  // ── USE TEMPLATE ──
  const handleUseTemplate = (template: Template) => {
    Alert.alert(
      'Use this template',
      `Load "${template.title}" into your timeline?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use template',
          onPress: () => {
            setSelectedVideoUri(template.video_url || '');
            setClips([{
              id: `template-${template.id}`,
              title: template.title || 'Template',
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
    if (!selectedVideoUri) return;
    setIsExporting(true);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permission requise ❌', "L'accès à la galerie est nécessaire.");
        return;
      }
      await CameraRoll.save(selectedVideoUri, { type: 'video', album: 'CapCut Clone' });
      Alert.alert('Succès ! 🎉', 'Vidéo enregistrée directement dans votre galerie Android.');
    } catch (err) {
      const e: any = err;
      Alert.alert('Erreur ❌', 'Impossible d\'enregistrer le fichier : ' + (e.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareVideo = async () => {
    if (!selectedVideoUri) return;
    setIsExporting(true);
    try {
      await Share.open({
        url: selectedVideoUri,
        type: 'video/mp4',
        title: 'Partager votre montage CapCut',
      });
    } catch (err) {
      const e: any = err;
      if (e.message !== 'User did not share') {
        Alert.alert('Erreur de partage ❌', e.message || 'Impossible de partager la vidéo.');
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
      const e: any = err;
      Alert.alert('Cloud error', e.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyText = () => {
    setVideoText(inputText);
    setIsTextModalVisible(false);
  };

  const applyFilter = (filterName: string) => {
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
                  <TouchableOpacity
                    style={styles.templateCard}
                    activeOpacity={0.85}
                    onPress={() => openFullscreenTemplate(item)}
                  >
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
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ONGLET 5 : PROFIL UTILISATEUR "MOI" (DESIGN EXACT CAPCUT) */}
      {activeTab === 'Moi' && (
        <View style={styles.profileContainer}>
          {/* Section d'en-tête utilisateur */}
          <View style={styles.profileHeader}>
            <View style={styles.profileAvatarLarge}>
              <Text style={styles.avatarLargeText}>U</Text>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileUsername}>CapCut_Creator_99</Text>
              <Text style={styles.profileId}>ID : 482910472</Text>
            </View>
          </View>

          {/* Section des statistiques */}
          <View style={styles.statsCounterRow}>
            <View style={styles.statBox}>
              <Text style={styles.statCountNumber}>12</Text>
              <Text style={styles.statCountLabel}>Modèles</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statCountNumber}>3.4K</Text>
              <Text style={styles.statCountLabel}>Abonnés</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statCountNumber}>25.1K</Text>
              <Text style={styles.statCountLabel}>Mentions J'aime</Text>
            </View>
          </View>

          {/* Onglets de contenu (Modèles / Projets sauvegardés) */}
          <View style={styles.profileContentTabs}>
            <TouchableOpacity style={[styles.profileSubTab, { borderBottomColor: '#000', borderBottomWidth: 2 }]}>
              <Text style={{ fontWeight: 'bold', color: '#000' }}>Mes créations</Text>
            </TouchableOpacity>
          </View>

          {/* Grille vide ou historique des projets */}
          <ScrollView contentContainerStyle={styles.draftsScrollArea}>
            {clips.length > 0 ? (
              <View style={styles.draftCard}>
                <Icon name="film-outline" size={24} color="#8E8E93" />
                <Text style={styles.draftCardText}>Projet en cours : {clips.length} clip(s)</Text>
                <Text style={styles.draftCardDuration}>{totalDuration}s</Text>
              </View>
            ) : (
              <View style={styles.emptyDraftsState}>
                <Icon name="folder-open-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyDraftsText}>Aucun modèle publié pour le moment.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* ONGLET 4 : GESTION DES PROJETS CLOUD */}
      {activeTab === 'Projets' && (
        <View style={styles.projectsContainer}>
          <Text style={styles.projectsMainTitle}>Brouillons Cloud</Text>
          
          {isLoadingProjects ? (
            <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
          ) : userProjects.length > 0 ? (
            <ScrollView contentContainerStyle={styles.projectsScrollArea}>
              {userProjects.map((project) => (
                <View key={project.id} style={styles.projectCloudCard}>
                  <View style={styles.projectIconFrame}>
                    <Icon name="film" size={24} color="#007FFF" />
                  </View>
                  <View style={styles.projectInfoMeta}>
                    <Text style={styles.projectTitleText}>{project.title}</Text>
                    <Text style={styles.projectDateText}>
                      Modifié le : {new Date(project.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.projectActionsRow}>
                    <TouchableOpacity style={styles.loadProjectBtn} onPress={() => handleLoadProject(project)}>
                      <Icon name="pencil" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteProjectCloudBtn} onPress={() => handleDeleteProjectFromCloud(project.id)}>
                      <Icon name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyProjectsState}>
              <Icon name="cloud-offline-outline" size={54} color="#C7C7CC" />
              <Text style={styles.emptyProjectsText}>Aucun brouillon enregistré sur votre compte.</Text>
            </View>
          )}
        </View>
      )}

      {/* ONGLET 3 : LABO D'IA Workspace (DESIGN CLASSIQUE CAPCUT) */}
      {activeTab === "Labo d'IA" && (
        <ScrollView style={styles.aiContainer} contentContainerStyle={{ paddingBottom: 90 }}>
          <Text style={styles.aiMainTitle}>Labo d'IA</Text>

          {/* Bannière principale mise en avant */}
          <View style={styles.aiHeroBanner}>
            <View style={styles.aiHeroTextFrame}>
              <Text style={styles.aiHeroTitle}>Texte en Image IA</Text>
              <Text style={styles.aiHeroSubtitle}>Transformez vos mots en œuvres d'art uniques instantanément.</Text>
            </View>
            <View style={styles.aiHeroIconFrame}>
              <MCIcon name="creation" size={40} color="#FFF" />
            </View>
          </View>

          {/* Zone de Prompt interactive */}
          <View style={styles.aiPromptCard}>
            <TextInput
              style={styles.aiTextInput}
              placeholder="Décrivez ce que vous voulez créer (ex: Un astronaute qui fait du surf dans l'espace)..."
              placeholderTextColor="#8E8E93"
              multiline
              value={aiPrompt}
              onChangeText={setAiPrompt}
            />
            <TouchableOpacity 
              style={styles.aiGenerateBtn} 
              onPress={handleGenerateAIContent}
              disabled={isGeneratingAI}
            >
              {isGeneratingAI ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Icon name="sparkles" size={16} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.aiGenerateBtnText}>Générer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Grille des outils IA secondaires */}
          <Text style={styles.aiSectionTitle}>Fonctionnalités populaires</Text>
          <View style={styles.aiToolsGrid}>
            <TouchableOpacity style={styles.aiToolGridCard} onPress={() => Alert.alert('Outil IA', 'Retouche de visage par IA activée.') }>
              <Icon name="happy-outline" size={26} color="#A855F7" />
              <Text style={styles.aiToolGridLabel}>Retouche Visage</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.aiToolGridCard} onPress={() => Alert.alert('Outil IA', 'Amélioration de la netteté photo activée.') }>
              <Icon name="image-outline" size={26} color="#3B82F6" />
              <Text style={styles.aiToolGridLabel}>Glow Up Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.aiToolGridCard} onPress={() => Alert.alert('Outil IA', 'Générateur d\'autocollants personnalisés.') }>
              <Icon name="color-palette-outline" size={26} color="#10B981" />
              <Text style={styles.aiToolGridLabel}>Autocollants IA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.aiToolGridCard} onPress={() => Alert.alert('Outil IA', 'Suppression automatique du fond vidéo.') }>
              <Icon name="cut-outline" size={26} color="#EF4444" />
              <Text style={styles.aiToolGridLabel}>Détourage Vidéo</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ONGLET 2 : MODÈLES CAPCUT */}
      {activeTab === 'Modèles' && (
        <View style={styles.templatesTabContainer}>
          {/* Barre de recherche supérieure interactive */}
          <View style={styles.searchBarRow}>
            <View style={styles.searchField}>
              <Icon name="search" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Rechercher sur CapCut"
                placeholderTextColor="#8E8E93"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchTemplates}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchTemplates('')}>
                  <Icon name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.autoCutBtn} onPress={() => Alert.alert('Décpg auto', 'Sélectionnez des clips pour générer un montage automatique.') }>
              <MCIcon name="auto-fix" size={20} color="#000" />
              <Text style={styles.autoCutText}>Décpg auto</Text>
            </TouchableOpacity>
          </View>

          {isLoadingTemplates ? (
            <ActivityIndicator size="large" color="#007FFF" style={{ marginTop: 30 }} />
          ) : templates.length > 0 ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 120 }}>
              {templates.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.templateCard}
                  activeOpacity={0.85}
                  onPress={() => openFullscreenTemplate(item)}
                >
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
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <MCIcon name="video-off-outline" size={48} color="#555" />
              <Text style={styles.emptyStateText}>Aucun modèle trouvé.</Text>
            </View>
          )}
        </View>
      )}

      {/* BARRE DE NAVIGATION INFÉRIEURE À 5 ONGLETS SÉCURISÉE */}
      <View style={styles.bottomTabBar}>
        {[
          { name: 'content-cut', label: 'Éditer', tab: 'Éditer' },
          { name: 'play-circle-outline', label: 'Modèles', tab: 'Modèles' },
          { name: 'auto-fix', label: "Labo d'IA", tab: "Labo d'IA" },
          { name: 'folder-open-outline', label: 'Projets', tab: 'Projets' },
          { name: 'account-outline', label: 'Moi', tab: 'Moi' }
        ].map((item) => (
          <TouchableOpacity 
            key={item.label} 
            style={styles.tabItem} 
            onPress={() => {
              setActiveTab(item.tab);
              if (item.tab === 'Modèles') loadTemplates(activeCategory);
              if (item.tab === 'Projets') loadUserProjects();
            }}
          >
            <MCIcon 
              name={item.name} 
              size={22} 
              color={activeTab === item.tab ? '#000' : '#8E8E93'} 
            />
            <Text style={[styles.tabLabel, activeTab === item.tab && styles.tabLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* MODAL DU LECTEUR PLEIN ÉCRAN (STYLE TIKTOK) */}
      <Modal visible={isFullscreenPlayerVisible} animationType="slide" transparent={false}>
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity style={styles.closeFullscreenBtn} onPress={() => setIsFullscreenPlayerVisible(false)}>
            <Icon name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.fullscreenVideoPlaceholder}>
            {selectedTemplateForView?.video_url ? (
              <Video
                source={{ uri: selectedTemplateForView.video_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                repeat
                paused={false}
              />
            ) : null}
          </View>

          <View style={styles.rightInteractionBar}>
            <TouchableOpacity style={styles.interactionIcon} onPress={() => Alert.alert("J'aime ❤️", "Modèle ajouté à vos favoris.")}>
              <Icon name="heart" size={32} color="#fff" />
              <Text style={styles.interactionText}>33.6K</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.interactionIcon} onPress={() => Alert.alert("Commentaires 💬", "Espace de discussion CapCut.")}>
              <Icon name="chatbubble-ellipses" size={32} color="#fff" />
              <Text style={styles.interactionText}>1.2K</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.interactionIcon} onPress={handleExport}>
              <Icon name="share-social" size={32} color="#fff" />
              <Text style={styles.interactionText}>Partager</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomTemplateDetails}>
            <Text style={styles.fullscreenCreator}>@{selectedTemplateForView ? `creator_${selectedTemplateForView.id.substring(0,5)}` : 'CapCut_User'}</Text>
            <Text style={styles.fullscreenTitle}>{selectedTemplateForView ? selectedTemplateForView.title : 'Titre du modèle'}</Text>
            <Text style={styles.fullscreenSpecs}>⏱️ {selectedTemplateForView ? selectedTemplateForView.duration : '0.0'}s  | 🎞️ 1 clip fixe</Text>

            <TouchableOpacity 
              style={styles.useTemplateBigBtn}
              onPress={() => {
                if (selectedTemplateForView) {
                  handleUseTemplate(selectedTemplateForView);
                  setIsFullscreenPlayerVisible(false);
                }
              }}
            >
              <Text style={styles.useTemplateBigBtnText}>Utiliser le modèle</Text>
            </TouchableOpacity>
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

  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingBottom: 10,
    zIndex: 999, // Force l'affichage par-dessus tout le reste
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: Dimensions.get('window').width / 5, // Aligne parfaitement les 5 onglets à l'écran
  },
  tabLabel: { color: '#8E8E93', fontSize: 11, marginTop: 3 },
  tabLabelActive: { color: '#fff', fontWeight: '700' },

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

  // ── FULLSCREEN TEMPLATE PLAYER ──
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  closeFullscreenBtn: { position: 'absolute', top: 40, left: 15, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 },
  fullscreenVideoPlaceholder: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  rightInteractionBar: { position: 'absolute', right: 15, bottom: 240, alignItems: 'center', zIndex: 15 },
  interactionIcon: { alignItems: 'center', marginBottom: 22 },
  interactionText: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  bottomTemplateDetails: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.4)', paddingBottom: 35 },
  fullscreenCreator: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  fullscreenTitle: { color: '#E5E5EA', fontSize: 13, marginBottom: 15 },
  fullscreenSpecs: { color: '#AEAEB2', fontSize: 11, marginBottom: 15 },
  useTemplateBigBtn: { backgroundColor: '#00F0FF', paddingVertical: 14, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  useTemplateBigBtnText: { color: '#000', fontSize: 15, fontWeight: 'bold' },

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

  // ── CLOUD PROJECTS ──
  projectsContainer: { flex: 1, backgroundColor: '#FFF', paddingTop: 40 },
  projectsMainTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', paddingHorizontal: 20, marginBottom: 15 },
  projectsScrollArea: { paddingHorizontal: 15, paddingBottom: 80 },
  projectCloudCard: { flexDirection: 'row', backgroundColor: '#F2F2F7', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' },
  projectIconFrame: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#E6F4FE', alignItems: 'center', justifyContent: 'center' },
  projectInfoMeta: { flex: 1, marginLeft: 12 },
  projectTitleText: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  projectDateText: { fontSize: 11, color: '#8E8E93', marginTop: 3 },
  projectActionsRow: { flexDirection: 'row', alignItems: 'center' },
  loadProjectBtn: { backgroundColor: '#007FFF', padding: 8, borderRadius: 6, marginRight: 8 },
  deleteProjectCloudBtn: { backgroundColor: '#FFF', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E5E5EA' },
  emptyProjectsState: { alignItems: 'center', marginTop: 100 },
  emptyProjectsText: { color: '#8E8E93', fontSize: 13, marginTop: 12 },
  templatesTabContainer: { flex: 1, backgroundColor: '#FFF' },
  searchBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, marginBottom: 15, marginTop: 10 },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginRight: 10 },
  searchInput: { flex: 1, color: '#000', fontSize: 13, paddingVertical: 0 },
  autoCutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  autoCutText: { marginLeft: 8, color: '#000', fontSize: 12, fontWeight: 'bold' },

  // ── LABO D'IA ──
  aiContainer: { flex: 1, backgroundColor: '#FFF', paddingTop: 40 },
  aiMainTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', paddingHorizontal: 20, marginBottom: 15 },
  aiHeroBanner: { backgroundColor: '#7C3AED', marginHorizontal: 15, padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  aiHeroTextFrame: { flex: 1, marginRight: 10 },
  aiHeroTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  aiHeroSubtitle: { fontSize: 11, color: '#DDD', marginTop: 4, lineHeight: 16 },
  aiHeroIconFrame: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  aiPromptCard: { backgroundColor: '#F2F2F7', marginHorizontal: 15, padding: 12, borderRadius: 12, marginBottom: 20 },
  aiTextInput: { minHeight: 60, color: '#000', fontSize: 13, textAlignVertical: 'top', padding: 0, marginBottom: 10 },
  aiGenerateBtn: { backgroundColor: '#00F0FF', height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 20 },
  aiGenerateBtnText: { color: '#000', fontSize: 13, fontWeight: 'bold' },
  aiSectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#000', paddingHorizontal: 20, marginBottom: 12 },
  aiToolsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11, justifyContent: 'space-between' },
  aiToolGridCard: { width: (Dimensions.get('window').width - 32) / 2, backgroundColor: '#F2F2F7', padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  aiToolGridLabel: { color: '#000', fontSize: 12, fontWeight: '600', marginTop: 8 },

  // ── PROFIL UTILISATEUR ──
  profileContainer: { flex: 1, backgroundColor: '#FFF', paddingTop: 30 },
  profileHeader: { flexDirection: 'row', paddingHorizontal: 20, alignItems: 'center', marginVertical: 20 },
  profileAvatarLarge: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center' },
  avatarLargeText: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  profileMeta: { marginLeft: 15 },
  profileUsername: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  profileId: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  statsCounterRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-around', alignItems: 'center', marginVertical: 15 },
  statBox: { alignItems: 'center', flex: 1 },
  statCountNumber: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  statCountLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 20, backgroundColor: '#E5E5EA' },
  profileContentTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', marginTop: 15 },
  profileSubTab: { paddingVertical: 12, paddingHorizontal: 20 },
  draftsScrollArea: { padding: 15 },
  draftCard: { backgroundColor: '#F2F2F7', padding: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', position: 'relative' },
  draftCardText: { marginLeft: 10, fontSize: 13, color: '#000', fontWeight: '500' },
  draftCardDuration: { position: 'absolute', right: 15, color: '#8E8E93', fontSize: 12 },
  emptyDraftsState: { alignItems: 'center', marginTop: 60 },
  emptyDraftsText: { color: '#8E8E93', fontSize: 13, marginTop: 10 },
});