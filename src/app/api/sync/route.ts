import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to extract Sheet ID from URL
function extractSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

// Helper to get CSV URL
function getPublishedCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=csv`;
}

// GET - Get sync config and logs
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'logs') {
      const logs = await db.syncLog.findMany({
        take: 20,
        orderBy: { startedAt: 'desc' }
      });
      return NextResponse.json({ success: true, data: logs });
    }

    if (action === 'export') {
      const residents = await db.resident.findMany({
        orderBy: { updatedAt: 'desc' }
      });
      
      const headers = [
        'NIK', 'No KK', 'Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir',
        'Jenis Kelamin', 'Agama', 'Pekerjaan', 'Golongan Darah',
        'Status Perkawinan', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Kelurahan',
        'Alamat', 'Status Warga', 'Tanggal Status', 'Keterangan Status', 'Updated At'
      ];

      const rows = residents.map(r => [
        r.nik, r.noKk, r.name, r.pob, r.dob, r.gender, r.religion, r.occupation,
        r.bloodType, r.maritalStatus, r.province, r.regency, r.district, r.village,
        r.address || '', r.status, r.statusDate || '', r.statusNote || '', r.updatedAt.toISOString()
      ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sync_warga_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: get config
    const config = await db.syncConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Save config, test connection, or run sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'test': {
        const sheetId = extractSheetId(data.sheetUrl);
        if (!sheetId) {
          return NextResponse.json({ 
            success: false, 
            data: { success: false, message: 'URL Google Sheet tidak valid' } 
          });
        }
        
        try {
          const response = await fetch(getPublishedCsvUrl(sheetId));
          if (!response.ok) {
            return NextResponse.json({ 
              success: false, 
              data: { success: false, message: 'Sheet tidak dapat diakses. Pastikan sudah di-publish ke web.' } 
            });
          }
          const text = await response.text();
          const lines = text.split('\n').filter(l => l.trim());
          return NextResponse.json({ 
            success: true, 
            data: { success: true, message: `Koneksi berhasil! Ditemukan ${Math.max(0, lines.length - 1)} baris data.`, rowCount: Math.max(0, lines.length - 1) } 
          });
        } catch (e: any) {
          return NextResponse.json({ 
            success: false, 
            data: { success: false, message: e.message } 
          });
        }
      }

      case 'connect': {
        const sheetId = extractSheetId(data.sheetUrl);
        const config = await db.syncConfig.upsert({
          where: { id: 'default' },
          create: {
            sheetUrl: data.sheetUrl,
            sheetId: sheetId,
            sheetName: data.sheetName || 'Sheet1',
            autoSync: data.autoSync ?? false,
            syncInterval: data.syncInterval ?? 60,
            isActive: true,
          },
          update: {
            sheetUrl: data.sheetUrl,
            sheetId: sheetId,
            sheetName: data.sheetName || 'Sheet1',
            autoSync: data.autoSync ?? false,
            syncInterval: data.syncInterval ?? 60,
            isActive: true,
          }
        });
        return NextResponse.json({ success: true, data: config });
      }

      case 'pull': {
        const config = await db.syncConfig.findFirst({
          where: { isActive: true }
        });
        
        if (!config?.sheetId) {
          return NextResponse.json({ 
            success: false, 
            data: { success: false, message: 'Konfigurasi sinkronisasi tidak ditemukan' } 
          });
        }
        
        // Simple pull - just return success for now
        return NextResponse.json({ 
          success: true, 
          data: { success: true, message: 'Fitur pull dalam pengembangan', recordsPulled: 0, recordsUpdated: 0, recordsFailed: 0 } 
        });
      }

      case 'sync': {
        return NextResponse.json({ 
          success: true, 
          data: { success: true, message: 'Fitur sync dalam pengembangan', recordsPulled: 0, recordsUpdated: 0, recordsFailed: 0 } 
        });
      }

      case 'disconnect': {
        await db.syncConfig.deleteMany({});
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove sync config
export async function DELETE() {
  try {
    await db.syncConfig.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
