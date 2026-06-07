import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const StudentDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [studentData, setStudentData] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [marks, setMarks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // Fetch student profile
      const studentRes = await api.get('/students/me/');
      setStudentData(studentRes.data);

      // Fetch attendance
      const attendanceRes = await api.get('/attendance/my-attendance/');
      setAttendance(attendanceRes.data);

      // Fetch marks
      const marksRes = await api.get('/academics/my-marks/');
      setMarks(marksRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudentData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome!</Text>
          <Text style={styles.userName}>{user?.full_name || 'Student'}</Text>
          {studentData && <Text style={styles.rollNumber}>Roll: {studentData.suid}</Text>}
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {studentData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Academic Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>School:</Text>
            <Text style={styles.value}>{studentData.school?.display_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.value, { color: studentData.status === 'ACTIVE' ? '#27ae60' : '#e74c3c' }]}>
              {studentData.status}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Admission Date:</Text>
            <Text style={styles.value}>{new Date(studentData.admission_date).toLocaleDateString()}</Text>
          </View>
        </View>
      )}

      {attendance && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attendance</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{attendance.present || 0}</Text>
              <Text style={styles.statLabel}>Present</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{attendance.absent || 0}</Text>
              <Text style={styles.statLabel}>Absent</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{attendance.percentage || 0}%</Text>
              <Text style={styles.statLabel}>Percentage</Text>
            </View>
          </View>
        </View>
      )}

      {marks && Array.isArray(marks) && marks.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Latest Marks</Text>
          {marks.slice(0, 3).map((mark, index) => (
            <View key={index} style={styles.markRow}>
              <Text style={styles.subjectName}>{mark.subject?.name}</Text>
              <Text style={styles.markValue}>{mark.total_marks || mark.marks}/100</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Links</Text>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📚 My Assignments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📝 My Results</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📢 Announcements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>👥 My Teachers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    color: '#7f8c8d',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 12,
  },
  greeting: {
    fontSize: 14,
    color: '#ecf0f1',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  rollNumber: {
    fontSize: 12,
    color: '#bdc3c7',
    marginTop: 4,
  },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e74c3c',
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  label: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    padding: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  markRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  subjectName: {
    fontSize: 14,
    color: '#2c3e50',
  },
  markValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  link: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  linkText: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
  },
  spacer: {
    height: 40,
  },
});
