import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { UserPhoto } from '../_models/user-photo';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE = 'photos';

  constructor(private platform: Platform) {
    this.loadSaved();
  }

  async addNewToGallery() {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    })

    const savedImageFile = await this.savePhoto(capturedPhoto);
    this.photos.unshift(savedImageFile);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    })
  }

  private async savePhoto(photo: Photo): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(photo);

    const fileName = new Date().getTime() + '.jpeg'
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    })

    if (this.platform.is('hybrid')) {
      return {
        filePath: savedFile.uri,
        webViewPath: Capacitor.convertFileSrc(savedFile.uri)
      }
    } else {
      return {
        filePath: fileName,
        webViewPath: photo.webPath
      };
    }
  }

  private async readAsBase64(photo: Photo): Promise<string> {
    if (this.platform.is('hybrid')) {
      const file = await Filesystem.readFile({
        path: photo.path!
      });

      return file.data;
    } else {
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
  
      return await this.convertBlobToBase64(blob) as string;
    }
  }

  private convertBlobToBase64(blob: Blob): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      // reader.onload = () => resolve(reader.result);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    })
  }

  async loadSaved() {
    const photoList = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value!) ?? [];

    if (!this.platform.is('hybrid')) {
      for (const photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data
        });
  
        photo.webViewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  public async deletePicture(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });

    const filename = photo.filePath.substring(photo.filePath.lastIndexOf('/') + 1);

    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data,
    });
  }
}
