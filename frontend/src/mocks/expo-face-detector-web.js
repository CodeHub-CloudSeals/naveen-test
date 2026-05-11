// Web platform mock — expo-face-detector is native-only
export const FaceDetectorMode = { fast: 1, accurate: 2 };
export const FaceDetectorLandmarks = { none: 0, all: 1 };
export const FaceDetectorClassifications = { none: 0, all: 1 };
export const detectFacesAsync = async () => ({ faces: [] });
