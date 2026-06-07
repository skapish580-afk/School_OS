import React from 'react';
import { StatusBar } from 'expo-status-bar';
import App from './App';

export default function index() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <App />
    </>
  );
}
