'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, AlertCircle, Lock, Users, TrendingUp, Save, ArrowLeft } from 'lucide-react'

interface Student {
  id: number
  student: {
    id: number
    suid: string
    user_name: string
    profile_photo: string | null
  }
  roll_number: string | null
  status: string
  remarks: string
  time_in: string | null
}

interface AttendanceSession {
  id: number
  grade: string
  section: string
  date: string
  session_type: string
  total_students: number
  present_count: number
  absent_count: number
  late_count: number
  out_count: number
  is_locked: boolean
  created_by_name: string
  records: Student[]
}

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', color: 'bg-green-500', icon: CheckCircle },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-500', icon: XCircle },
  { value: 'LATE', label: 'Late', color: 'bg-orange-500', icon: Clock },
  { value: 'OUT', label: 'Out (Gate Pass)', color: 'bg-purple-500', icon: AlertCircle },
  { value: 'EXCUSED', label: 'Excused', color: 'bg-blue-500', icon: CheckCircle },
  { value: 'MEDICAL', label: 'Medical', color: 'bg-yellow-500', icon: AlertCircle }
]

export default function AttendanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [updates, setUpdates] = useState<Map<number, Partial<Student>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSession()
  }, [params.id])

  const fetchSession = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/attendance/${params.id}/`)
      if (res.ok) {
        const data = await res.json()
        setSession(data)
      }
    } catch (error) {
      console.error('Error fetching session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (studentId: number, status: string) => {
    const current = updates.get(studentId) || {}
    setUpdates(new Map(updates.set(studentId, { ...current, status })))
  }

  const handleRemarksChange = (studentId: number, remarks: string) => {
    const current = updates.get(studentId) || {}
    setUpdates(new Map(updates.set(studentId, { ...current, remarks })))
  }

  const handleTimeChange = (studentId: number, time_in: string) => {
    const current = updates.get(studentId) || {}
    setUpdates(new Map(updates.set(studentId, { ...current, time_in })))
  }

  const handleSave = async () => {
    if (session?.is_locked) {
      alert('This session is locked and cannot be modified.')
      return
    }

    setSaving(true)
    try {
      const updatesArray = Array.from(updates.entries()).map(([student_id, changes]) => ({
        student_id,
        ...changes
      }))

      const res = await fetch(`http://localhost:8000/api/v1/attendance/${params.id}/mark_bulk/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updatesArray })
      })

      if (res.ok) {
        alert('Attendance updated successfully!')
        setUpdates(new Map())
        fetchSession()
      } else {
        const error = await res.json()
        alert(`Error: ${error.detail || 'Failed to save'}`)
      }
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const getDisplayStatus = (student: Student) => {
    const update = updates.get(student.id)
    return update?.status || student.status
  }

  const getDisplayRemarks = (student: Student) => {
    const update = updates.get(student.id)
    return update?.remarks !== undefined ? update.remarks : student.remarks
  }

  const getDisplayTimeIn = (student: Student) => {
    const update = updates.get(student.id)
    return update?.time_in !== undefined ? update.time_in : student.time_in
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find(s => s.value === status)
    if (!statusConfig) return null

    const Icon = statusConfig.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${statusConfig.color}`}>
        <Icon className="w-3 h-3" />
        {statusConfig.label}
      </span>
    )
  }

  const getAttendanceRate = () => {
    if (!session || session.total_students === 0) return 0
    return ((session.present_count / session.total_students) * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading attendance session...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Session not found</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Attendance: Grade {session.grade}-{session.section}
            </h1>
            <p className="text-gray-600 mt-1">
              {new Date(session.date).toLocaleDateString()} • {session.session_type} • Marked by {session.created_by_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session.is_locked ? (
            <span className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
              <Lock className="w-5 h-5" />
              Locked
            </span>
          ) : (
            <>
              <span className="text-sm text-gray-600">
                {updates.size} unsaved {updates.size === 1 ? 'change' : 'changes'}
              </span>
              <button
                onClick={handleSave}
                disabled={saving || updates.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{session.total_students}</p>
            </div>
            <Users className="w-10 h-10 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Present</p>
              <p className="text-2xl font-bold text-green-600">{session.present_count}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Absent</p>
              <p className="text-2xl font-bold text-red-600">{session.absent_count}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Late</p>
              <p className="text-2xl font-bold text-orange-600">{session.late_count}</p>
            </div>
            <Clock className="w-10 h-10 text-orange-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Attendance Rate</p>
              <p className="text-2xl font-bold text-blue-600">{getAttendanceRate()}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Student Records */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Student Attendance Records</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SUID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {session.records.map((record) => (
                <tr key={record.id} className={`hover:bg-gray-50 ${updates.has(record.id) ? 'bg-yellow-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                    {record.roll_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                    {record.student.suid}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {record.student.profile_photo ? (
                        <img
                          src={`http://localhost:8000${record.student.profile_photo}`}
                          alt={record.student.user_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600 text-sm font-medium">
                            {record.student.user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-gray-900">{record.student.user_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.is_locked ? (
                      getStatusBadge(record.status)
                    ) : (
                      <select
                        value={getDisplayStatus(record)}
                        onChange={(e) => handleStatusChange(record.id, e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {session.is_locked ? (
                      <span className="text-gray-700">{record.time_in || '-'}</span>
                    ) : (
                      <input
                        type="time"
                        value={getDisplayTimeIn(record) || ''}
                        onChange={(e) => handleTimeChange(record.id, e.target.value)}
                        disabled={getDisplayStatus(record) !== 'LATE'}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {session.is_locked ? (
                      <span className="text-gray-700">{record.remarks || '-'}</span>
                    ) : (
                      <input
                        type="text"
                        value={getDisplayRemarks(record)}
                        onChange={(e) => handleRemarksChange(record.id, e.target.value)}
                        placeholder="Optional remarks..."
                        className="w-full px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
