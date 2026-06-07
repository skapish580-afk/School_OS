import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const TeacherDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [teacherData, setTeacherData] = useState(null);
  const [classes, setClasses] = useState(null);
  const [students, setStudents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      // Fetch teacher profile
      const teacherRes = await api.get('/teachers/me/');
      setTeacherData(teacherRes.data);

      // Fetch assigned classes/sections
      const classesRes = await api.get('/academics/my-sections/');
      setClasses(classesRes.data);

      // Fetch students assigned to this teacher
      const studentsRes = await api.get('/students/my-students/');
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeacherData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#9b59b6" />
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
          <Text style={styles.greeting}>Welcome Back!</Text>
          <Text style={styles.userName}>{user?.full_name || 'Teacher'}</Text>
          {teacherData && <Text style={styles.qualification}>{teacherData.qualifications}</Text>}
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {teacherData && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Teacher Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>School:</Text>
            <Text style={styles.value}>
              {teacherData.school_associations?.[0]?.school?.display_name || 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Experience:</Text>
            <Text style={styles.value}>{teacherData.experience_years || 0} years</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Gender:</Text>
            <Text style={styles.value}>{teacherData.gender || 'N/A'}</Text>
          </View>
        </View>
      )}

      {classes && Array.isArray(classes) && classes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Classes</Text>
          {classes.map((section, index) => (
            <View key={index} style={styles.classItem}>
              <View>
                <Text style={styles.className}>
                  {section.grade_config?.grade_name} - Section {section.section_letter}
                </Text>
                <Text style={styles.classCapacity}>Capacity: {section.capacity} students</Text>
              </View>
              <TouchableOpacity style={styles.classBtn}>
                <Text style={styles.classBtnText}>View</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {students && Array.isArray(students) && students.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Students ({students.length})</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{students.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{students.filter(s => s.status === 'ACTIVE').length}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Teacher Tools</Text>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📝 Mark Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>✏️ Enter Marks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📋 Assignment Management</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>📢 Send Announcements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link}>
          <Text style={styles.linkText}>👥 View Class Roster</Text>
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
    backgroundColor: '#9b59b6',
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
  qualification: {
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
  classItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  className: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  classCapacity: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  classBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#9b59b6',
    borderRadius: 4,
  },
  classBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#9b59b6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  link: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  linkText: {
    fontSize: 14,
    color: '#9b59b6',
    fontWeight: '500',
  },
  spacer: {
    height: 40,
  },
});
