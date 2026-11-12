import { useState } from 'react';

import { AllProfilesDialog } from './AllProfilesDialog.jsx';
import { ProfileCarousel } from './ProfileCarousel.jsx';
import { ProfileDialog } from './ProfileDialog.jsx';
import { ProfileIcon } from './ProfileIcon.jsx';
import { RouteProfileEditor } from './RouteProfileEditor.jsx';

// From here the row no longer fits on a phone: the full list with its search is offered.
const ALL_PROFILES_FROM = 4;

// The routes of the user (PBI-6): choosing one decides how the next route is calculated. The icons
// act on the chosen one; the weights are edited in a pop-up.
export function RouteProfilePicker({
  profiles,
  selectedId,
  isEditable,
  loadFailed,
  onSelect,
  onSave,
  onDelete,
  onReplace,
}) {
  // null, 'all', 'new', 'edit' or 'delete'.
  const [dialog, setDialog] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  // A replacement that updated the existing route but could not delete the edited one (#165).
  const [notice, setNotice] = useState('');
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;
  const closeDialog = () => setDialog(null);

  async function save(draft) {
    const saved = await onSave(dialog === 'edit' ? selected.id : null, draft);
    setDialog(null);
    onSelect(saved.id);
  }

  async function replace(existingId, draft, editedId) {
    setNotice('');
    try {
      const saved = await onReplace(existingId, draft, editedId);
      setDialog(null);
      onSelect(saved.id);
    } catch (error) {
      if (!error.saved) throw error;
      setDialog(null);
      onSelect(error.saved.id);
      setNotice(error.message);
    }
  }

  async function remove() {
    setDeleteError('');
    try {
      await onDelete(selected.id);
      setDialog(null);
    } catch (error) {
      setDeleteError(error.message);
    }
  }

  return (
    <fieldset className="route-type-mode route-profiles">
      <legend className="visually-hidden">Tipo de ruta</legend>
      <div className="route-profiles-header">
        <span className="route-profiles-title" aria-hidden="true">
          Tipo de ruta
        </span>
        {profiles.length >= ALL_PROFILES_FROM && (
          <button type="button" className="route-profiles-all" onClick={() => setDialog('all')}>
            Ver todas
          </button>
        )}
        {isEditable && (
          <div className="route-profile-tools">
            <button
              type="button"
              aria-label="Nueva ruta"
              title="Nueva ruta"
              onClick={() => setDialog('new')}
            >
              <ProfileIcon kind="plus" />
            </button>
            {/* The recommended route is chosen by the backend: nothing to edit or delete. */}
            {selected && !selected.readOnly && (
              <>
                <button
                  type="button"
                  aria-label={`Editar ${selected.name}`}
                  title="Editar"
                  onClick={() => setDialog('edit')}
                >
                  <ProfileIcon kind="edit" />
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    className="route-profile-tool-delete"
                    aria-label={`Borrar ${selected.name}`}
                    title="Borrar"
                    onClick={() => {
                      setDeleteError('');
                      setDialog('delete');
                    }}
                  >
                    <ProfileIcon kind="delete" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <ProfileCarousel profiles={profiles} selectedId={selectedId} onSelect={onSelect} />
      {notice && (
        <p className="form-message form-message-error" role="alert">
          {notice}
        </p>
      )}
      {loadFailed && (
        <p className="form-message" role="status">
          No se han podido cargar tus rutas: puedes usar las predefinidas, pero no cambiarlas.
        </p>
      )}
      {dialog === 'all' && (
        <AllProfilesDialog
          profiles={profiles}
          selectedId={selectedId}
          onSelect={onSelect}
          onClose={closeDialog}
        />
      )}
      {(dialog === 'new' || dialog === 'edit') && (
        <ProfileDialog
          title={dialog === 'new' ? 'Nueva ruta' : 'Editar ruta'}
          onClose={closeDialog}
        >
          <RouteProfileEditor
            profile={dialog === 'edit' ? selected : null}
            profiles={profiles.filter((profile) => !profile.readOnly)}
            onSave={save}
            onReplace={onReplace ? replace : undefined}
            onCancel={closeDialog}
          />
        </ProfileDialog>
      )}
      {dialog === 'delete' && selected && (
        <ProfileDialog title={`¿Borrar «${selected.name}»?`} onClose={closeDialog}>
          <p className="profile-dialog-text">Solo se borra de tu cuenta.</p>
          {deleteError && (
            <p className="form-message form-message-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="profile-dialog-actions">
            <button type="button" className="secondary-button" onClick={closeDialog}>
              Cancelar
            </button>
            <button type="button" className="profile-dialog-danger" onClick={remove}>
              Borrar
            </button>
          </div>
        </ProfileDialog>
      )}
    </fieldset>
  );
}
