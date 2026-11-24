import React from 'react';
import {
  Mic,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
  Globe,
  Briefcase,
  GraduationCap,
  Download,
  ChevronDown,
  Lightbulb,
  Sun,
  Scissors,
  Store,
  Monitor,
  User,
  Square,
  Keyboard,
  Edit3,
  Clock,
  IndianRupee,
  Layers,
  Info,
  Menu,
  X,
  Star,
  Copy,
  Route,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  PhoneCall,
  WifiOff,
  Target,
  Compass,
  Crosshair,
  ShieldCheck,
  Search,
  Zap,
  Navigation,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  LogOut,
  Shield,
  AlertCircle,
  Filter,
  TrendingUp,
  Award,
  Users,
  Share2,
  ExternalLink,
  Heart,
  Smartphone,
  Bell,
  Camera,
  Lock,
  Bookmark,
  Moon,
} from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, className = '', style }) => {
  switch (name) {
    case 'mic': return <Mic size={size} className={className} style={style} />;
    case 'pin':
    case 'mapPin':
      return <MapPin size={size} className={className} style={style} />;
    case 'arrowR':
    case 'arrow':
      return <ArrowRight size={size} className={className} style={style} />;
    case 'arrowL': return <ArrowLeft size={size} className={className} style={style} />;
    case 'check': return <Check size={size} className={className} style={style} />;
    case 'globe': return <Globe size={size} className={className} style={style} />;
    case 'briefcase': return <Briefcase size={size} className={className} style={style} />;
    case 'cap': return <GraduationCap size={size} className={className} style={style} />;
    case 'download': return <Download size={size} className={className} style={style} />;
    case 'chev': return <ChevronDown size={size} className={className} style={style} />;
    case 'bulb': return <Lightbulb size={size} className={className} style={style} />;
    case 'sun': return <Sun size={size} className={className} style={style} />;
    case 'moon': return <Moon size={size} className={className} style={style} />;
    case 'scissors': return <Scissors size={size} className={className} style={style} />;
    case 'store': return <Store size={size} className={className} style={style} />;
    case 'monitor': return <Monitor size={size} className={className} style={style} />;
    case 'user': return <User size={size} className={className} style={style} />;
    case 'stop': return <Square size={size} className={className} style={style} />;
    case 'keyboard': return <Keyboard size={size} className={className} style={style} />;
    case 'edit': return <Edit3 size={size} className={className} style={style} />;
    case 'clock': return <Clock size={size} className={className} style={style} />;
    case 'rupee': return <IndianRupee size={size} className={className} style={style} />;
    case 'layers': return <Layers size={size} className={className} style={style} />;
    case 'info': return <Info size={size} className={className} style={style} />;
    case 'menu': return <Menu size={size} className={className} style={style} />;
    case 'x': return <X size={size} className={className} style={style} />;
    case 'star': return <Star size={size} className={className} style={style} />;
    case 'bookmark': return <Bookmark size={size} className={className} style={style} />;
    case 'copy': return <Copy size={size} className={className} style={style} />;
    case 'route': return <Route size={size} className={className} style={style} />;
    case 'volume2':
    case 'volume':
      return <Volume2 size={size} className={className} style={style} />;
    case 'volumeX': return <VolumeX size={size} className={className} style={style} />;
    case 'sparkles': return <Sparkles size={size} className={className} style={style} />;
    case 'refresh': return <RefreshCw size={size} className={className} style={style} />;
    case 'phone': return <PhoneCall size={size} className={className} style={style} />;
    case 'wifiOff': return <WifiOff size={size} className={className} style={style} />;
    case 'target': return <Target size={size} className={className} style={style} />;
    case 'compass': return <Compass size={size} className={className} style={style} />;
    case 'crosshair': return <Crosshair size={size} className={className} style={style} />;
    case 'shieldCheck': return <ShieldCheck size={size} className={className} style={style} />;
    case 'shield': return <Shield size={size} className={className} style={style} />;
    case 'logout': return <LogOut size={size} className={className} style={style} />;
    case 'alert': return <AlertCircle size={size} className={className} style={style} />;
    case 'filter': return <Filter size={size} className={className} style={style} />;
    case 'trending': return <TrendingUp size={size} className={className} style={style} />;
    case 'award': return <Award size={size} className={className} style={style} />;
    case 'users': return <Users size={size} className={className} style={style} />;
    case 'share': return <Share2 size={size} className={className} style={style} />;
    case 'external': return <ExternalLink size={size} className={className} style={style} />;
    case 'heart': return <Heart size={size} className={className} style={style} />;
    case 'device': return <Smartphone size={size} className={className} style={style} />;
    case 'search': return <Search size={size} className={className} style={style} />;
    case 'zap': return <Zap size={size} className={className} style={style} />;
    case 'navigation': return <Navigation size={size} className={className} style={style} />;
    case 'map': return <MapIcon size={size} className={className} style={style} />;
    case 'maximize': return <Maximize2 size={size} className={className} style={style} />;
    case 'minimize': return <Minimize2 size={size} className={className} style={style} />;
    case 'arrowUp': return <ArrowUp size={size} className={className} style={style} />;
    case 'arrowDown': return <ArrowDown size={size} className={className} style={style} />;
    case 'trash': return <Trash2 size={size} className={className} style={style} />;
    case 'eye': return <Eye size={size} className={className} style={style} />;
    case 'eyeOff': return <EyeOff size={size} className={className} style={style} />;
    case 'upload': return <Upload size={size} className={className} style={style} />;
    case 'image': return <ImageIcon size={size} className={className} style={style} />;
    case 'link': return <LinkIcon size={size} className={className} style={style} />;
    case 'plus': return <Plus size={size} className={className} style={style} />;
    case 'bell': return <Bell size={size} className={className} style={style} />;
    case 'camera': return <Camera size={size} className={className} style={style} />;
    case 'lock': return <Lock size={size} className={className} style={style} />;
    default: return null;
  }
};
