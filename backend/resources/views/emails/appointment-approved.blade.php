@extends('emails._layout')

@section('body')
  <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">
    Magandang araw, {{ $appointment->full_name }}!
  </p>

  <p style="margin:0 0 16px;">
    Ang inyong kahilingan para sa appointment sa <strong>Barangay Natumolan</strong> ay 
    <span style="display:inline-block;padding:2px 10px;background:#DEF7EC;color:#03543F;font-weight:700;border-radius:12px;font-size:12px;">APRUBAHAN / CONFIRMED</span>.
  </p>

  <table style="width:100%;margin:20px 0;border-collapse:collapse;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;font-size:13px;">
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;width:35%;">Reference No.:</td>
      <td style="padding:10px 16px;font-weight:700;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_number }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Petsa (Date):</td>
      <td style="padding:10px 16px;font-weight:700;color:#723EC3;border-bottom:1px solid #E5E7EB;">{{ \Carbon\Carbon::parse($appointment->appointment_date)->format('F d, Y (l)') }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Oras (Time):</td>
      <td style="padding:10px 16px;font-weight:700;color:#723EC3;border-bottom:1px solid #E5E7EB;">{{ $appointment->appointment_time }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;border-bottom:1px solid #E5E7EB;">Pakay (Purpose):</td>
      <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #E5E7EB;">{{ $appointment->purpose }}</td>
    </tr>
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#6B7280;">Lugar (Location):</td>
      <td style="padding:10px 16px;color:#111827;">Barangay Hall, Barangay Natumolan, Tagoloan</td>
    </tr>
  </table>

  <p style="margin:16px 0;font-size:13px;color:#4B5563;">
    <strong>Mahalagang Paalala:</strong> Mangyaring magdala ng inyong valid ID (o Barangay Resident ID) at anumang dokumentong may kinalaman sa inyong sadya. Dumating po sa Barangay Hall 10-15 minuto bago ang inyong nakatakdang oras.
  </p>

  <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">
    Maraming salamat sa inyong kooperasyon.<br>
    <strong>Office of the Barangay Secretary & Punong Barangay</strong>
  </p>
@endsection

