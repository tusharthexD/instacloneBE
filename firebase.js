// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCex5b5XCEPhNaImlSvoYz6zOIzCS0DsY",
  authDomain: "igclonetushar.firebaseapp.com",
  projectId: "igclonetushar",
  storageBucket: "igclonetushar.appspot.com",
  messagingSenderId: "901254576077",
  appId: "1:901254576077:web:37a5e9ac63ba1e55d9b684"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app)